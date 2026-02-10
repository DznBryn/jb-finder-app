from dataclasses import dataclass
import tiktoken

@dataclass
class TaskBudget:
    """Track task budget for LLM usage."""
    max_input_tokens: int
    max_output_tokens: int

BUDGETS = {
    "resume_parse": TaskBudget(max_input_tokens=6000, max_output_tokens=2400),
    "job_skills":   TaskBudget(max_input_tokens=2500, max_output_tokens=500),
    "search_query": TaskBudget(max_input_tokens=800,  max_output_tokens=200),
    "job_match":    TaskBudget(max_input_tokens=7000, max_output_tokens=1400),
    "resume_review":TaskBudget(max_input_tokens=6000, max_output_tokens=1200),
    "cover_patch":  TaskBudget(max_input_tokens=3000, max_output_tokens=900),
}


def truncate_to_tokens(text: str, model: str = "gpt-5", max_tokens: int = 12000) -> str:
    enc = tiktoken.encoding_for_model(model)
    tokens = enc.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return enc.decode(tokens[:max_tokens])