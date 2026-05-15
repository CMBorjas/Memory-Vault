"""
Anti-Gravity Mnemonic Engine — Core Generation Logic

Generates grotesque sensory mnemonics based on book configuration profiles.
Each book has a biological kingdom, aesthetic, and scent profile that
shapes the imagery and anchors produced.
"""
import random
import logging
from pathlib import Path

import yaml

logger = logging.getLogger("anti-gravity.engine")

# Mnemonic visual templates organized by biological kingdom
VISUAL_TEMPLATES = {
    "Amphibians": [
        "Imagine {term} as a translucent newt whose skin is {action}, stretched across {context}. Its belly glows with data packets visible through decaying membrane.",
        "A bloated salamander sits atop {context}, its eyes weeping {term}. Each blink sends signals through its withering nervous system.",
        "Picture a tree frog clinging to {context}, its toxic skin secreting {term} in fluorescent droplets that burn through the surface.",
    ],
    "Insects": [
        "A swarm of beetles spells out {term} with their chitinous bodies, clicking mandibles in binary across {context}.",
        "Imagine {term} as a wasp nest built inside {context} — each hexagonal cell stores a different data value, humming with electricity.",
        "A column of fire ants carries {term} across {context}, each ant a single bit, their collective march forming the complete instruction.",
    ],
    "Fungi": [
        "Mycelium threads of {term} spread parasitically through {context}, each tendril a connection that feeds on the host system.",
        "A cluster of bioluminescent mushrooms grows from {context}, their caps displaying {term} in pulsing, sickly green light.",
        "Spore clouds of {term} erupt from decomposing {context}, each microscopic spore carrying encrypted payloads.",
    ],
    "Arachnids": [
        "A spider weaves {term} into its web across {context}, each silk strand a thread of execution vibrating with trapped data.",
        "Imagine {term} as a scorpion lurking beneath {context}, its segmented tail curled with queued processes ready to strike.",
        "Tick-like processes burrow into {context}, feeding on {term} — bloating with data until they're ready to transmit.",
    ],
    "Cephalopods": [
        "An octopus wraps its tentacles around {context}, each sucker pattern encoding {term} in shifting chromatophore displays.",
        "Imagine {term} as an ink cloud released by a squid fleeing through {context} — the ink itself contains the solution.",
        "A cuttlefish pulses {term} across its skin in hypnotic waves, camouflaged against {context} until the pattern resolves.",
    ],
}

SCENT_TEMPLATES = [
    "The {primary} hits first — {primary_desc}. Then the {secondary} creeps in — {secondary_desc}. Together they lock {term} into your memory.",
    "Breathe in: the {primary} is overwhelming, {primary_desc}. Breathe out: the {secondary} coats your throat, {secondary_desc}. This is {term}.",
    "Close your eyes. The {primary} fills the room, {primary_desc}. Underneath it, barely detectable, the {secondary} lingers — {secondary_desc}. You will not forget {term}.",
]

SCENT_DESCRIPTIONS = {
    "Ambrosia": "suffocatingly sweet like wilting funeral flowers in an enclosed room",
    "Ammonia": "sharp and eye-watering like an uncleaned reptile tank",
    "Ozone": "metallic and electric like the air after a lightning strike",
    "Sulfur": "thick and nauseating like rotten eggs from volcanic vents",
    "Truffle": "earthy and rich, almost obscenely organic",
    "Damp Copper": "cold and mineral, like pennies left in a flooded basement",
    "Petrichor": "ancient and clean, like the first rain on scorched stone",
    "Formaldehyde": "sharp and preserving, stinging like a specimen jar cracked open",
    "Brine": "overwhelming salt-rot, a tide pool baking at noon",
    "Iodine": "medicinal and throat-coating, swabbed on an open wound",
}

LOGIC_TEMPLATES = [
    "The {imagery} is your brain's trigger for **{term}** — {explanation}.",
    "Why {imagery}? Because {term} works the same way: {explanation}.",
    "Remember: {imagery} = {term}. The connection: {explanation}.",
]


class MnemonicEngine:
    """Generates grotesque sensory mnemonics from book configuration profiles."""

    def __init__(self, config_path: Path):
        self.config = {}
        if config_path.exists():
            with open(config_path) as f:
                self.config = yaml.safe_load(f) or {}
            books = list(self.config.get("books", {}).keys())
            logger.info(f"Loaded config with {len(books)} books: {books}")
        else:
            logger.warning(f"Config not found: {config_path}")

    def generate(self, section: dict, book_name: str) -> dict:
        """Generate mnemonics for a section using the book's profile."""
        profile = self.config.get("books", {}).get(book_name, {})
        kingdom = profile.get("kingdom", "Amphibians")
        title = section.get("title", "Unknown")
        key_terms = section.get("key_terms", [])
        content_preview = section.get("content", "")[:200]

        # Build the acronym mnemonic from the title
        acronym = self._build_acronym(title, profile)

        # Pick a visual template for the kingdom
        templates = VISUAL_TEMPLATES.get(kingdom, VISUAL_TEMPLATES["Amphibians"])
        primary_term = key_terms[0] if key_terms else title
        visual = random.choice(templates).format(
            term=primary_term, action=profile.get("aesthetic", "decaying").lower(),
            context=f"the {title.lower()} architecture"
        )

        # Build scent anchor
        scent = self._build_scent(primary_term, profile)

        # Build logic link
        imagery_word = profile.get("visual_keywords", ["the creature"])[0] if profile.get("visual_keywords") else "the creature"
        logic = random.choice(LOGIC_TEMPLATES).format(
            imagery=imagery_word, term=primary_term,
            explanation=f"just as {imagery_word} {profile.get('aesthetic', 'decay').lower()}, so does this concept operate"
        )

        return {
            "acronym": acronym,
            "visual_anchor": visual,
            "scent_anchor": scent,
            "logic_link": logic,
            "kingdom": kingdom,
            "aesthetic": profile.get("aesthetic", ""),
        }

    def _build_acronym(self, title: str, profile: dict) -> str:
        """Build a grotesque acronym mnemonic from a section title."""
        words = title.split()
        keywords = profile.get("visual_keywords", [])
        if not keywords:
            return title

        acronym_parts = []
        for word in words[:5]:
            first_letter = word[0].upper()
            matching = [kw for kw in keywords if kw[0].upper() == first_letter]
            if matching:
                acronym_parts.append(random.choice(matching).capitalize())
            else:
                acronym_parts.append(word)

        return " ".join(acronym_parts)

    def _build_scent(self, term: str, profile: dict) -> str:
        """Build a scent anchor description."""
        primary = profile.get("scent_primary", "Ambrosia")
        secondary = profile.get("scent_secondary", "Ammonia")
        return random.choice(SCENT_TEMPLATES).format(
            primary=primary, secondary=secondary, term=term,
            primary_desc=SCENT_DESCRIPTIONS.get(primary, "intense and unforgettable"),
            secondary_desc=SCENT_DESCRIPTIONS.get(secondary, "lingering and sharp"),
        )
