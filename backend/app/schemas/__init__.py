from app.schemas.school import SchoolCreate, SchoolUpdate, SchoolResponse
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse,
    LoginRequest, TokenResponse, SchoolBrief
)
from app.schemas.student import (
    StudentCreate, StudentUpdate, StudentResponse,
    StudentContactCreate, StudentContactResponse
)
from app.schemas.academic import (
    AcademicYearCreate, AcademicYearResponse,
    TermCreate, TermResponse,
    ClassCreate, ClassResponse,
    SubjectCreate, SubjectResponse,
)
from app.schemas.attendance import (
    AttendanceBulkCreate, AttendanceResponse
)
from app.schemas.sync import SyncBatchRequest, SyncBatchResponse