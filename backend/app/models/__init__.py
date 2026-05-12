from app.models.school import School
from app.models.staff import Staff, StaffQualification, StaffPromotion
from app.models.ges_rank import GESRank
from app.models.user import User
from app.models.assessment import (
    GradingScale,
    GradingBand,
    AssessmentCategory,
    Assessment,
    AssessmentScore,
    TermResult,
    ScoreEditLog,
)
from app.models.academic import AcademicYear, Term, Class, Subject
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.models.enrollment import Enrollment
from app.models.school_house import SchoolHouse
from app.models.school_period import SchoolPeriod
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.programme import SystemProgramme, SchoolProgramme