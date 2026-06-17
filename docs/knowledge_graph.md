# Anti-Gravity Mnemonic Engine - IT Knowledge Graph

This document provides a high-level overview and architectural knowledge graph of the **Anti-Gravity Mnemonic Engine (Memory Vault)** project. It is intended to significantly reduce the onboarding and reading time for IT and engineering staff.

## System Architecture Knowledge Graph

```mermaid
graph TD
    %% Define Styles
    classDef frontend fill:#2d3748,stroke:#4fd1c5,stroke-width:2px,color:#fff;
    classDef backend fill:#2c5282,stroke:#63b3ed,stroke-width:2px,color:#fff;
    classDef data fill:#742a2a,stroke:#fc8181,stroke-width:2px,color:#fff;
    classDef output fill:#276749,stroke:#68d391,stroke-width:2px,color:#fff;
    classDef infra fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;

    %% Frontend Components
    subgraph "Frontend Layer (Client-Side)"
        UI["Web GUI<br/>(Vanilla JS / HTML / CSS)"]:::frontend
        PDFJS["PDF.js & PDF-lib<br/>(Client-Side Slicing)"]:::frontend
    end

    %% Backend Components
    subgraph "Backend Layer (FastAPI Container)"
        API["FastAPI Server<br/>(main.py)"]:::backend
        ME["Mnemonic Engine<br/>(engine.py)"]:::backend
        EX["Vault Exporter<br/>(exporter.py)"]:::backend
        CONF["Narrative Profiles<br/>(book_config.yml)"]:::backend
    end

    %% Storage Components
    subgraph "Data Storage Layer"
        UP["Raw / Split PDFs<br/>(data/uploads/)"]:::data
        PROC["JSON Documents & Progress<br/>(data/processed/)"]:::data
    end

    %% Outputs
    subgraph "System Outputs"
        VAULT["Obsidian Vault<br/>(vault/ - .md files)"]:::output
        GH["GitHub Pages<br/>(Sanitized HTML View)"]:::output
    end

    %% Infrastructure
    subgraph "Infrastructure & Lifecycle"
        DC["Docker Compose<br/>(docker-compose.yml)"]:::infra
        LAUNCH["Startup Script<br/>(scripts/launch.sh)"]:::infra
        INSTALL["Desktop Installer<br/>(scripts/install_launcher.sh)"]:::infra
        KDE["KDE Plasma Shortcut<br/>(memory-vault.desktop)"]:::infra
    end

    %% Relationships
    UI -->|1. Uploads / Adjusts PDF| API
    UI -->|Client-side rendering| PDFJS
    
    API -->|2. Extracts text & delegates| ME
    ME -->|Reads generation rules| CONF
    API -->|3. Triggers export| EX
    
    API -->|Reads/Writes Files| UP
    API -->|Stores State/Metadata| PROC
    
    EX -->|4. Writes Locus Notes| VAULT
    EX -->|Writes Sanitized Docs| GH
    
    INSTALL -->|Creates| KDE
    KDE -->|Executes| LAUNCH
    LAUNCH -->|Spins up| DC
    DC -.->|Hosts| API
    DC -.->|Mounts| VAULT
    DC -.->|Mounts| UP
```

## Component Breakdown

### 1. Frontend Layer
* **Role**: The main interface for the user to upload textbooks and interactively split chapters.
* **Tech Stack**: Vanilla HTML5, CSS3, JavaScript (ES6).
* **Key Feature**: Offloads heavy PDF splitting to the client browser using `pdf-lib` and `pdf.js` to avoid crashing the backend.

### 2. Backend Layer (Python/FastAPI)
* **Role**: Orchestrates mnemonic generation, text extraction, and exporting.
* **`main.py`**: The REST API entry point routing traffic and managing state (`data/progress.json`).
* **`engine.py`**: The core logic engine that generates cognitive anchors based on subject profiles.
* **`exporter.py`**: Compiles the generated anchors and text into Obsidian Markdown files.
* **`book_config.yml`**: Contains mapping between tech subjects (e.g., Networking) and their sensory mnemonic profiles (e.g., Amphibians, Ambrosia/Ammonia).

### 3. Data Storage (`data/` directory)
* **`uploads/`**: Stores raw user uploads and pre-split chapters.
* **`processed/`**: Stores canonical JSON files representing each ingested chapter and its generated mnemonics.

### 4. System Outputs (`vault/` directory)
* **Locus View**: Output formatted for Obsidian, utilizing collapsible Markdown callouts (`> [!abstract]-`) to hide grotesque anchors until needed.
* **Sanitized View**: Cleaned HTML versions suitable for public portfolios.

### 5. Infrastructure & Lifecycle (`scripts/`)
* **Local-First Containerization**: Uses `docker-compose.yml` to run the FastAPI service locally without exposing it to the web.
* **KDE Desktop Integration**: IT / Users can run `./scripts/install_launcher.sh` once to add a desktop icon. Clicking the icon runs `launch.sh` which ensures Docker is running, spins up the containers, and opens the local web page in the default browser.
