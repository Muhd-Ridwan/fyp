import logging
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from bedrock_client import generate_response
from dependencies import get_current_employee
from rag import query_documents

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

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
    
    try:
        chunks = query_documents(question, department)
    except Exception as e:
        logger.error("Pinecone query failed for dept %s: %s", department, e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to search documents")

    if not chunks:
        context = "No relevant documents found in your department."
    else:
        context = "\n\n".join(
            f"[{c['display_name']}]\n{c['text']}" for c in chunks
        )
    
    prompt = (
        "You are DocuVault AI, an intelligent document assistant for an organisation. "
        "Your job is to answer employee questions based strictly on the documents stored in their department.\n\n"
        
        "INSTRUCTIONS:\n"
        "1. Answer using ONLY the information found in the document excerpts below.\n"
        "2. Always cite which document your answer comes from using the format: (Source: filename).\n"
        "3. If the question can be partially answered, provide what you can and clearly state what is missing.\n"
        "4. Structure your response clearly — use bullet points or numbered steps where appropriate.\n"
        "5. Be specific and detailed. Do not give vague or one-line answers.\n"
        "6. If the answer truly cannot be found in any of the provided documents, say: "
        "'I could not find this information in your department documents. "
        "Please check with your team or upload the relevant document.'\n"
        "7. Never make up information that is not in the documents.\n\n"
        
        f"DOCUMENT EXCERPTS:\n{context}\n\n"
        f"EMPLOYEE QUESTION: {question}\n\n"
        "YOUR ANSWER:"
    )

    try:
        answer = generate_response(prompt)
    except Exception as e:
        logger.error("Bedrock generate response failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="AI service is unavailable, please try again")
    
    return {"answer": answer}