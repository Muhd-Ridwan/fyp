from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from bedrock_client import generate_response
from dependencies import get_current_employee
from rag import query_documents

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    question: str

@router.post("")
def chat(
    body: ChatRequest,
    employee: dict = Depends(get_current_employee),
):
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned for this acc")
    
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    chunks = query_documents(question, department)

    if not chunks:
        context = "No relevant documents found in your department."
    else:
        context = "\n\n".join(
            f"[{c['display_name']}]\n{c['text']}" for c in chunks
        )
    
    prompt = (
        "You are a helpful AI assistant. "
        "Answer the user's question using ONLY the document excerpts provided below. "
        "If the answer cannot be found in the documents, say so clearly.\n\n"
        f"Documents:\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer:"
    )

    answer = generate_response(prompt)
    return {"answer": answer}