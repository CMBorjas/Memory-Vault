# Anti-Gravity Knowledge Engine (AGKE)
**Grotesque Sensory Mnemonics for CS Notes**

**Anti-Gravity** is a containerized, horizontally scalable knowledge ecosystem designed to bridge the gap between "Cold Data" (Textbooks/PDFs) and "Living Knowledge" (Mnemonics & Sensory Anchors).

## The Core Philosophy: "Dissonance for Retention"

Standard wikis fail because they are "clean." AGKE succeeds by being **grotesque**. By utilizing sensory dissonance—clashing sweet ambrosia with caustic ammonia—we anchor technical CS concepts into long-term biological storage.

### The "Sanitizer" Protocol
The system maintains a dual-state:
1. **Locus View:** The grotesque, mnemonic-rich study mode (used locally in Obsidian).
2. **Sanitized View:** A professional, production-ready export for portfolios/sharing, purged of all "disturbing" imagery or references to the mnemonic anchors.

---

## Architecture 

### 1. The Mnemonic Engine
A containerized FastAPI application (`mnemonic_engine/`) that serves as the heart of the system.
* **PDF Import:** Ingests raw textbook PDFs and splits them into logical sections based on font-size heuristics.
* **Mnemonic Generation:** Uses Jinja2 templates and configurable profiles to generate unique acronyms, visual anchors, and scent profiles for each Chapter, subsection, and key terms within each section.
* **Web GUI:** A premium dark-themed interface for uploading PDFs, reviewing generated mnemonics, editing them interactively, and exporting to the vault.

### 2. The Locus Vault
The generated knowledge is exported directly into an **Obsidian** vault (`vault/` directory) as cleanly formatted Markdown files (`.md`), keeping the original structure intact while injecting the memory anchors as Obsidian callouts.

### 3. Future: Data Redundancy
*Currently shelved for local development:*
* Integration with University OneDrive / Google Drive via `rclone` for raw PDF sourcing.
* Local NAS (NFS/SMB) for persistent backups.
* Syncthing for P2P redundancy between Desktop and NAS.

---

## Book-Scale Mnemonic Reasoning

Each book/module in the vault is assigned a biological kingdom and a sensory profile in `book_config.yml` to prevent "memory bleeding":

| Subject | Biological Anchor | Mnemonic Aesthetic | Scent Profile |
| --- | --- | --- | --- |
| **Networking** | Amphibians | Withering/Decaying | Ambrosia + Ammonia |
| **Databases** | Insects | Chitinous/Swarming | Ozone + Sulfur |
| **Cybersecurity** | Fungi | Parasitic/Spores | Truffle + Damp Copper |
| **Algorithms** | Cephalopods | Shifting/Ink-Cloud | Brine + Iodine |
| **OS** | Arachnids | Webbing/Lurking | Petrichor + Formaldehyde |
| **etc..**| etc.. | etc.. | etc.. |

## Example Document Generation (Locus View)

> ---
> # Chapter 3: Wide Area Network (W.A.N.)
>
>> book: networking \
>> cssclasses: ecosystem-aquatic
> ---
> 
> This chapter covers long-haul data routing methodologies.
> 
> ## Section 3.1: Attenuation Metrics
>> When scaling links across vast spaces, signal degradation becomes a primary bottleneck.
>>
>> **Wide Area Network (WAN)**-> [!abstract] Mnemonic Anchor (Golf Token)
> ## **Mnemonic:** (WAN) **W**.ithering **A**.mbrosia **N**.ewts 
>> **Visual:** Continental-sized translucent amphibians bridging ocean floors; their skin tearing like rotting lilies.\
>> **Sensory:** The sweetness of funeral flowers fighting the eye-stinging stench of caustic ammonia.\
>> **Logic:** The *Withering* of the newt directly anchors the concept of **Signal Attenuation**.
>>> [Possible image placeholder for future iterations]\
>>> (author or AI used to generate images)\
---

## Deployment 

1. **Clone the repository:**
```bash
git clone <your-new-repo-url>
cd Memory-Vault
```

2. **Launch the Engine:**
```bash
docker-compose up -d --build
```

3. **Access the GUI:**
Open your browser to `http://localhost:8000` to upload PDFs, generate mnemonics, and export notes into the Obsidian vault.

---

## Tech Stack

* **Backend:** Python 3.11, FastAPI, Uvicorn
* **PDF Processing:** PyMuPDF (`fitz`)
* **Frontend:** Vanilla HTML/CSS/JS (Glassmorphism, Dark Theme)
* **Templating:** Jinja2, PyYAML
* **Deployment:** Docker & Docker Compose
* **Knowledge Base:** Obsidian (Markdown)