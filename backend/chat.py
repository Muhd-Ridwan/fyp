import logging
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from bedrock_client import generate_response
from dependencies import get_current_employee
from rag import query_documents, _extract_text

import dynamodb_client
import s3_client

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 10


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    history: list[ChatMessage] = []
    file_id: str | None = None


def _format_history(history: list[ChatMessage]) -> str:
    recent = history[-MAX_HISTORY_MESSAGES:]
    if not recent:
        return "No prior conversation."
    return "\n".join(
        f"{'Employee' if m.role == 'user' else 'AI'} : {m.content}" for m in recent
    )


def _rewrite_query(question: str, history: list[ChatMessage]) -> str:
    """
    Turn a vague follow-up into a standalone question using recent history.
    """
    prompt = (
        "You are a query-rewriting assistant for a document search system. "
        "Given a conversation history and the employee's latest question, rewrite the latest question "
        "into a fully self-contained, standalone question that a search engine could understand with "
        "zero prior context.\n\n"
        "RULES:\n"
        "1. Resolve all pronouns and reference ('it', 'that', 'the second one', 'those files') "
        "into their specific, concrete meaning using the conversation history.\n"
        "2. Preserve the employee's actual intent exactly - do not add new assumptions, do not answer "
        "the question, do not add information that wasn't implied by the history.\n"
        "3. If the latest question is already standalone and needs no context, return it completely "
        "unchanged.\n"
        "4. Keep it concise - a single clear question, not a paragraph.\n"
        "5. Reply with ONLY the rewritten question itself - no quotes, no labels, no explanation, "
        "no preamble.\n\n"
        f"CONVERSATION HISTORY:\n{_format_history(history)}\n\n"
        f"LATEST QUESTION: {question}\n\n"
        "STANDALONE QUESTION:"
    )

    try:
        return generate_response(prompt).strip()
    except Exception as e:
        logger.warning("Query rewrite failed, falling back to original question: %s", e)
        return question


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

    history_text = _format_history(body.history)

    if body.file_id:
        document = dynamodb_client.get_document(department, body.file_id)
        if document is None:
            raise HTTPException(status_code=404, detail="File not found")
        try:
            file_bytes = s3_client.download_file_by_key(document["s3_key"])
        except ClientError as e:
            logger.error(
                "S3 download failed for %s: %s", document["s3_key"], e, exc_info=True
            )
            raise HTTPException(
                status_code=503, detail="Failed to fetch file from storage"
            )

        text = _extract_text(file_bytes, document["display_name"])
        context = f"[{document['display_name']}]\n{text}"
    else:
        search_question = question
        if body.history:
            search_question = _rewrite_query(question, body.history)

        try:
            chunks = query_documents(search_question, department)
        except Exception as e:
            logger.error(
                "Pinecone query failed for dept %s: %s", department, e, exc_info=True
            )
            raise HTTPException(status_code=503, detail="Failed to search documents")

        if not chunks:
            context = "No relevant documents found in your department."
        else:
            context = "\n\n".join(f"[{c['display_name']}]\n{c['text']}" for c in chunks)

    prompt = (
        "You are DocuVault AI, an intelligent document assistant for an organisation. "
        "Your job is to answer employee questions based strictly on the documents stored in their department.\n\n"
        "INSTRUCTIONS:\n"
        "1. Answer using ONLY the information found in the document excerpts below.\n"
        "2. Always cite which document your answer comes from using the format: (Source: filename).\n"
        "3. If the question can be partially answered, provide what you can and clearly state what is missing. "
        "If content appears to be referenced but not actually present as text (e.g. code, output, or diagrams "
        "described but not shown), note that this may be because it exists inside an image, screenshot, or "
        "diagram embedded in the document - which you are currently unable to read - rather than being absent "
        "from the document entirely.\n"
        "4. Structure your response clearly — use bullet points or numbered steps where appropriate.\n"
        "5. Be specific and detailed. Do not give vague or one-line answers.\n"
        "6. Use the CONVERSATION HISTORY only to understand context (e.g. 'it', 'that point') - "
        "never as a source of factual information by itself.\n"
        "7. If the answer truly cannot be found in any of the provided documents, say: "
        "'I could not find this information in your department documents. This may be because the document "
        "does not contain it, or because the content is inside an image, screenshot, or diagram embedded in "
        "the document, which I am currently unable to read. Please check the original document directly, "
        "check with your team, upload the relevant document, or right-click a specific file "
        "and select Summarize to check its full content directly.'\n"
        "8. Never make up information that is not in the documents.\n\n"
        f"CONVERSATION HISTORY:\n{history_text}\n\n"
        f"DOCUMENT EXCERPTS:\n{context}\n\n"
        f"EMPLOYEE QUESTION: {question}\n\n"
        "YOUR ANSWER:"
    )

    try:
        answer = generate_response(prompt)
    except Exception as e:
        logger.error("Bedrock generate response failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503, detail="AI service is unavailable, please try again"
        )

    return {"answer": answer}
