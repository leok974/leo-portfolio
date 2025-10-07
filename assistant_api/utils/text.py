"""Text utilities for assistant API."""
from __future__ import annotations
import re


def slugify(text: str) -> str:
    """
    Convert text to URL-safe slug.
    
    Args:
        text: Input text to slugify
    
    Returns:
        Lowercase slug with hyphens
    
    Examples:
        >>> slugify("Hello World!")
        'hello-world'
        >>> slugify("DataPipe AI")
        'datapipe-ai'
    """
    # Convert to lowercase
    text = text.lower()
    
    # Replace non-alphanumeric with hyphens
    text = re.sub(r'[^a-z0-9]+', '-', text)
    
    # Remove leading/trailing hyphens
    text = text.strip('-')
    
    # Collapse multiple hyphens
    text = re.sub(r'-+', '-', text)
    
    return text
