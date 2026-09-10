from fastapi import FastAPI

# Create FastAPI application
app = FastAPI()


# Temporary student data
students = [
    {
        "id": 1,
        "name": "Ram",
        "course": "Python",
        "marks": 85
    },
    {
        "id": 2,
        "name": "Diya",
        "course": "AI",
        "marks": 90
    }
]


# GET
@app.get("/students")
def get_students():
    return students


# POST
@app.post("/students")
def add_student(data: dict):

    students.append(data)

    return {
        "message": "Student added successfully",
        "student": data
    }


# PUT
@app.put("/students/{student_id}")
def update_student(student_id: int, data: dict):

    for student in students:
        if student["id"] == student_id:
            student.update(data)
            return student

    return {"message": "Student not found"}


# DELETE
@app.delete("/students/{student_id}")
def delete_student(student_id: int):

    for student in students:
        if student["id"] == student_id:
            students.remove(student)

            return {
                "message": "Student deleted successfully"
            }

    return {
        "message": "Student not found"
    }
