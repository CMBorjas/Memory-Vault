import jinja2
from core.database import SessionLocal, ContentBlock

# Create a Jinja2 Environment
jinja_env = jinja2.Environment(autoescape=False)

def get_content_block_by_name(name: str) -> str:
    """Helper to fetch a content block's markup from database by name."""
    db = SessionLocal()
    try:
        block = db.query(ContentBlock).filter(ContentBlock.name == name).first()
        if block:
            return block.content
        return f"<!-- Content block '{name}' not found -->"
    except Exception as e:
        return f"<!-- Error loading block '{name}': {str(e)} -->"
    finally:
        db.close()

# Register the helper as a custom global function or filter
jinja_env.globals['include_block'] = get_content_block_by_name

def render_content(text: str) -> str:
    """
    Renders text containing Jinja2 syntax (e.g. {{ include_block('Withering Ambrosia Newts') }}).
    Recursively renders if included blocks contain other blocks.
    """
    if not text or "{{" not in text:
        return text
    try:
        template = jinja_env.from_string(text)
        rendered = template.render()
        # Handle simple nesting (1 level deep)
        if "{{" in rendered and rendered != text:
            rendered = jinja_env.from_string(rendered).render()
        return rendered
    except Exception as e:
        return f"<!-- Template rendering error: {str(e)} -->\n{text}"
