from typing import Annotated, List, Optional
from io import BytesIO
from datetime import date as date_type
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from fastapi import File, UploadFile
from fastapi.responses import StreamingResponse
from io import BytesIO
from datetime import date as date_type
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from fastapi import File, UploadFile
from fastapi.responses import StreamingResponse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.dependencies import CurrentUser, CurrentSchool, DB, require_roles
from app.models.user import User
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.schemas.student import (
    StudentCreate, StudentUpdate,
    StudentResponse, StudentContactCreate, StudentContactResponse
)

router = APIRouter()


# ── GET /api/students ──────────────────────────────────────────────────────

@router.get("/", response_model=List[StudentResponse])
async def list_students(
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
):
    query = select(Student).options(selectinload(Student.contacts)).where(Student.school_id == school.id)

    if search:
        query = query.where(
            Student.first_name.ilike(f"%{search}%") |
            Student.last_name.ilike(f"%{search}%") |
            Student.student_number.ilike(f"%{search}%")
        )
    if status:
        query = query.where(Student.status == status)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ── GET /api/students/{id} ─────────────────────────────────────────────────

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: UUID,
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
):
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.contacts))
        .where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )

    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


# ── POST /api/students ─────────────────────────────────────────────────────

@router.post("/", response_model=StudentResponse, status_code=201)
async def create_student(
    body: StudentCreate,
    user: Annotated[User, Depends(require_roles(
        "school_admin", "headteacher"
    ))],
    school: CurrentSchool,
    db: DB,
):
    # Check student number not already used in this school
    exists = await db.execute(
        select(Student).where(
            Student.school_id == school.id,
            Student.student_number == body.student_number,
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Student number '{body.student_number}' already exists",
        )

    student = Student(
        school_id=school.id,
        student_number=body.student_number,
        first_name=body.first_name,
        middle_name=body.middle_name,
        last_name=body.last_name,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        photo_url=body.photo_url,
        home_address=body.home_address,
        admission_date=body.admission_date,
        house=body.house,
        programme=body.programme,
    )
    db.add(student)
    await db.flush()   # get student.id before adding contacts

    # Add contacts if provided
    for c in body.contacts:
        contact = StudentContact(
            school_id=school.id,
            student_id=student.id,
            **c.model_dump(),
        )
        db.add(contact)

    await db.commit()
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.contacts))
        .where(Student.id == student.id)
    )
    return result.scalar_one()





# ── PATCH /api/students/{id} ───────────────────────────────────────────────

@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: UUID,
    body: StudentUpdate,
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
):
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Only update fields that were actually sent
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(student, field, value)

    await db.commit()
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.contacts))
        .where(Student.id == student.id)
    )
    return result.scalar_one()


# ── DELETE /api/students/{id} ──────────────────────────────────────────────

@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: UUID,
    user: Annotated[CurrentUser, Depends(require_roles("school_admin"))],
    school: CurrentSchool,
    db: DB,
):
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    await db.delete(student)
    await db.commit()


# ── POST /api/students/{id}/contacts ──────────────────────────────────────

@router.post("/{student_id}/contacts",
             response_model=StudentContactResponse,
             status_code=201)
async def add_contact(
    student_id: UUID,
    body: StudentContactCreate,
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
):
    # Verify student belongs to this school
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")

    # If this is primary contact, unset any existing primary
    if body.is_primary_contact:
        existing = await db.execute(
            select(StudentContact).where(
                StudentContact.student_id == student_id,
                StudentContact.is_primary_contact == True,
            )
        )
        for c in existing.scalars().all():
            c.is_primary_contact = False

    contact = StudentContact(
        school_id=school.id,
        student_id=student_id,
        **body.model_dump(),
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact
# ══════════════════════════════════════════════════════════════════════════
# BULK UPLOAD
# ══════════════════════════════════════════════════════════════════════════

@router.get("/upload/template")
async def download_template(
    user: CurrentUser,
    school: CurrentSchool,
):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Students"

    school_color  = (school.accent_color or "#1a6b3c").lstrip("#").upper()
    header_font   = Font(bold=True, color="FFFFFF", size=11)
    header_fill   = PatternFill("solid", fgColor=school_color)
    required_fill = PatternFill("solid", fgColor="E8F5E9")
    optional_fill = PatternFill("solid", fgColor="F5F5F5")
    center_align  = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A1:N1")
    ws["A1"] = f"{school.name} — Student Import Template"
    ws["A1"].font = Font(bold=True, size=13, color=school_color)
    ws["A1"].alignment = center_align
    ws.row_dimensions[1].height = 30

    ws.merge_cells("A2:N2")
    ws["A2"] = (
        "Instructions: Fill from row 4 onwards. "
        "Green columns are required. "
        "Do not change column headers. "
        "Date format: YYYY-MM-DD (e.g. 2008-03-15)"
    )
    ws["A2"].font = Font(italic=True, size=10, color="555555")
    ws["A2"].alignment = center_align
    ws.row_dimensions[2].height = 20

    columns = [
        ("student_number",     15, True,  "SHS001"),
        ("first_name",         15, True,  "Kofi"),
        ("middle_name",        15, False, "Adu"),
        ("last_name",          15, True,  "Mensah"),
        ("gender",             10, True,  "male"),
        ("date_of_birth",      15, False, "2008-03-15"),
        ("admission_date",     15, False, "2024-09-01"),
        ("house",              12, False, "Unity"),
        ("contact_first_name", 18, False, "Emmanuel"),
        ("contact_last_name",  18, False, "Mensah"),
        ("contact_relation",   18, False, "father"),
        ("contact_phone",      15, False, "0244123456"),
        ("contact_phone2",     15, False, ""),
        ("contact_is_parent",  15, False, "yes"),
    ]

    for col_idx, (header, width, required, _) in enumerate(columns, 1):
        cell = ws.cell(row=3, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        ws.column_dimensions[
            openpyxl.utils.get_column_letter(col_idx)
        ].width = width
    ws.row_dimensions[3].height = 20

    for col_idx, (_, _, required, example) in enumerate(columns, 1):
        cell = ws.cell(row=4, column=col_idx, value=example)
        cell.fill = required_fill if required else optional_fill
        cell.font = Font(italic=True, color="666666")

    gender_dv = DataValidation(
        type="list",
        formula1='"male,female"',
        allow_blank=True,
        showErrorMessage=True,
        errorTitle="Invalid gender",
        error="Please select male or female",
    )
    ws.add_data_validation(gender_dv)
    gender_dv.sqref = "E5:E10000"

    parent_dv = DataValidation(
        type="list",
        formula1='"yes,no"',
        allow_blank=True,
    )
    ws.add_data_validation(parent_dv)
    parent_dv.sqref = "N5:N10000"

    relation_dv = DataValidation(
        type="list",
        formula1='"father,mother,grandfather,grandmother,uncle,aunt,brother,sister,guardian,other"',
        allow_blank=True,
    )
    ws.add_data_validation(relation_dv)
    relation_dv.sqref = "K5:K10000"

    ws.freeze_panes = "A5"

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"{school.slug}_student_template.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/upload")
async def bulk_upload_students(
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
    file: UploadFile = File(...),
    class_id: Optional[UUID] = None,
    academic_year_id: Optional[UUID] = None,
    start_date: Optional[date_type] = None,
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "File must be an Excel file (.xlsx or .xls)")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(BytesIO(contents), data_only=True)
        ws = wb.active
    except Exception:
        raise HTTPException(400, "Could not read Excel file. Please use the template.")

    HEADER_ROW = 3
    DATA_START  = 4

    headers = []
    for cell in ws[HEADER_ROW]:
        if cell.value:
            headers.append(str(cell.value).strip())

    required_headers = {"student_number", "first_name", "last_name"}
    missing = required_headers - set(headers)
    if missing:
        raise HTTPException(
            400,
            f"Missing required columns: {missing}. Please use the downloaded template."
        )

    class_ = None
    if class_id:
        from app.models.academic import Class as ClassModel
        class_result = await db.execute(
            select(ClassModel).where(
                ClassModel.id == class_id,
                ClassModel.school_id == school.id,
            )
        )
        class_ = class_result.scalar_one_or_none()
        if not class_:
            raise HTTPException(404, "Class not found")
        if not academic_year_id or not start_date:
            raise HTTPException(
                400,
                "academic_year_id and start_date are required when class_id is provided"
            )

    imported  = 0
    skipped   = 0
    errors    = []
    seen_numbers = set()

    existing_result = await db.execute(
        select(Student.student_number).where(Student.school_id == school.id)
    )
    existing_numbers = {row[0] for row in existing_result.all()}

    for row_idx, row in enumerate(
        ws.iter_rows(min_row=DATA_START, values_only=True), start=DATA_START
    ):
        if not any(row):
            continue

        row_data = {}
        for i, header in enumerate(headers):
            row_data[header] = row[i] if i < len(row) else None

        row_errors = []

        student_number = str(row_data.get("student_number", "") or "").strip()
        first_name     = str(row_data.get("first_name", "") or "").strip()
        last_name      = str(row_data.get("last_name", "") or "").strip()

        if not student_number:
            row_errors.append("student_number is required")
        if not first_name:
            row_errors.append("first_name is required")
        if not last_name:
            row_errors.append("last_name is required")

        if student_number:
            if student_number in seen_numbers:
                row_errors.append(f"Duplicate student_number in file: {student_number}")
            elif student_number in existing_numbers:
                row_errors.append(f"Student number {student_number} already exists")
            else:
                seen_numbers.add(student_number)

        gender = str(row_data.get("gender", "") or "").strip().lower()
        if gender and gender not in ("male", "female"):
            row_errors.append(f"gender must be male or female, got: {gender}")
        gender = gender or None

        def parse_date(val, field_name):
            if not val:
                return None
            try:
                if isinstance(val, date_type):
                    return val
                return date_type.fromisoformat(str(val).strip())
            except ValueError:
                row_errors.append(f"{field_name} must be YYYY-MM-DD, got: {val}")
                return None

        dob          = parse_date(row_data.get("date_of_birth"),  "date_of_birth")
        admission_dt = parse_date(row_data.get("admission_date"), "admission_date")

        if row_errors:
            skipped += 1
            errors.append({
                "row":    row_idx,
                "data":   {"student_number": student_number,
                           "name": f"{first_name} {last_name}"},
                "errors": row_errors,
            })
            continue

        student = Student(
            school_id      = school.id,
            student_number = student_number,
            first_name     = first_name,
            middle_name    = str(row_data.get("middle_name", "") or "").strip() or None,
            last_name      = last_name,
            gender         = gender,
            date_of_birth  = dob,
            admission_date = admission_dt,
            house          = str(row_data.get("house", "") or "").strip() or None,
        )
        db.add(student)
        await db.flush()

        contact_first = str(row_data.get("contact_first_name", "") or "").strip()
        contact_phone = str(row_data.get("contact_phone", "") or "").strip()

        if contact_first and contact_phone:
            is_parent_val = str(
                row_data.get("contact_is_parent", "yes") or "yes"
            ).strip().lower()
            db.add(StudentContact(
                school_id          = school.id,
                student_id         = student.id,
                first_name         = contact_first,
                last_name          = str(row_data.get("contact_last_name", "") or "").strip() or None,
                relation           = str(row_data.get("contact_relation", "guardian") or "guardian").strip(),
                phone              = contact_phone,
                phone2             = str(row_data.get("contact_phone2", "") or "").strip() or None,
                is_parent          = is_parent_val == "yes",
                is_primary_contact = True,
                can_pickup         = True,
                receives_sms       = True,
                is_alive           = True,
            ))

        if class_id and academic_year_id and start_date:
            from app.models.enrollment import Enrollment
            db.add(Enrollment(
                school_id        = school.id,
                student_id       = student.id,
                class_id         = class_id,
                academic_year_id = academic_year_id,
                start_date       = start_date,
                status           = "active",
            ))

        imported += 1
        existing_numbers.add(student_number)

    await db.commit()

    return {
        "imported": imported,
        "skipped":  skipped,
        "errors":   errors,
        "message":  (
            f"Successfully imported {imported} students"
            + (f" and enrolled in {class_.name}" if class_ else "")
            + (f". {skipped} rows skipped." if skipped else ".")
        ),
    }
