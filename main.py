from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from supabase import create_client
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional
import os

# Load variable from .env
load_dotenv()

# Create FastAPI application
app = FastAPI(title="Student Management API")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Connect Python to Supabase
supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)

# Pydantic models for JSON body support
class StudentCreatePayload(BaseModel):
    name: Optional[str] = None
    course: Optional[str] = None
    marks: Optional[int] = None

class StudentUpdatePayload(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    course: Optional[str] = None
    marks: Optional[int] = None


@app.post("/students")
def create_student(
    name: Optional[str] = None, 
    course: Optional[str] = None, 
    marks: Optional[int] = None,
    payload: Optional[StudentCreatePayload] = None
):
    student_name = payload.name if (payload and payload.name is not None) else name
    student_course = payload.course if (payload and payload.course is not None) else course
    student_marks = payload.marks if (payload and payload.marks is not None) else marks

    if not student_name or not student_course or student_marks is None:
        raise HTTPException(status_code=400, detail="Student name, course, and marks are required.")

    student = {
        "name": student_name,
        "course": student_course,
        "marks": int(student_marks)
    }

    response = (
        supabase
        .table("students")
        .insert(student)
        .execute()
    )
    
    return {
        "message": "Student created successfully",
        "data": response.data
    }


@app.get("/students")
def show_all_student():
    response = (
        supabase
        .table("students")
        .select("*")
        .execute()
    )
    return {
        "message": "All students",
        "data": response.data
    }


@app.patch("/students")
def update_student(
    id: Optional[int] = None, 
    name: Optional[str] = None, 
    course: Optional[str] = None, 
    marks: Optional[int] = None,
    payload: Optional[StudentUpdatePayload] = None
):
    target_id = payload.id if (payload and payload.id is not None) else id
    student_name = payload.name if (payload and payload.name is not None) else name
    student_course = payload.course if (payload and payload.course is not None) else course
    student_marks = payload.marks if (payload and payload.marks is not None) else marks

    if target_id is None:
        raise HTTPException(status_code=400, detail="Student id is required for update.")

    student = {}
    if student_name is not None:
        student["name"] = student_name
    if student_course is not None:
        student["course"] = student_course
    if student_marks is not None:
        student["marks"] = int(student_marks)

    response = (
        supabase
        .table("students")
        .update(student)
        .eq("id", target_id)
        .execute()
    )

    return {
        "message": f"Data of id {target_id} updated successfully.",
        "data": response.data
    }


@app.delete("/students")
def delete_student(id: int):
    response = (
        supabase
        .table("students")
        .delete()
        .eq("id", id)
        .execute()
    )
    return {
        "message": f"Data of id {id} deleted successfully.",
        "data": response.data
    }


# Mount frontend static directory as root (serves index.html, style.css, app.js)
frontend_path = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
