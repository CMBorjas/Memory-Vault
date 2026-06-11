# Anti-Gravity Knowledge Engine (AGKE)
**Grotesque Sensory Mnemonics for CS Notes**

**Anti-Gravity** is a containerized, horizontally scalable knowledge ecosystem designed to bridge the gap between "Cold Data" (Textbooks/PDFs) and "Living Knowledge" (Mnemonics & Sensory Anchors).

## The Core Philosophy: "Dissonance for Retention"

Standard wikis fail because they are "clean." AGKE succeeds by being **grotesque**. By utilizing sensory dissonance—clashing sweet ambrosia with caustic ammonia—we anchor technical CS concepts into long-term biological storage.

### The "Sanitizer" Protocol
The system maintains a dual-state:
1. **Locus View:** The grotesque, mnemonic-rich study mode (used locally in Obsidian).
    - Needs to have a way to hide/show the mnemonics on the fly in obsidian to make it easier to study/review, the main concept and the definitions and details are what is to be memorized, but the mnemonics are just tools to help with that memorization, and are not meant to be memorized themselves, so being able to toggle them on and off would be ideal for a study/review session.
2. **Sanitized View:** A professional, production-ready export for portfolios/sharing, purged of all "disturbing" imagery or references to the mnemonic anchors need to be able to be hosted on the github pages statically attached to my showing a small demo of the first chapter with out the grotesque anchor mnemonics but with the definitions and interactive elements that make learning and memory retention easier and more engaging, this version of the demo needs to be very polished and use the very best web design practices to showcase the capabilities of the system. the anchor mnemonics should be replaced with simple, elegant, and professional descriptions of the concepts, for example instead of a grotesque descriptions. 

---

## Architecture 

### 1. The Mnemonic Engine
A containerized FastAPI application (`mnemonic_engine/`) that serves as the heart of the system.
* **PDF Import:** Ingests raw textbook PDFs and splits them into logical sections based on font-size heuristics can use personal repo API to split the . pdf files into chapters, and key terms visually and maybe with OCR, if that is possible to do with the API, as well as if the program is able to verify the contents if the user does not want to, using a hashing function from the repo to compare against the repo's copy of the book.
* **Story engine for mnemonic anchor generationn**:
The engine structure for mnemonic anchor generation will tell a story where each topic corresponds to a scene to move the story along. It uses the {user/generated} visuals to change the story. 
    * **Act One**: Exposition, Inciting Incident, Plot Point One (first quarter of the ingested text book)
    * **Act Two**: Rising Action, Midpoint, Plot Point Two (middle half of the ingested text book)
    * **Act Three**: Pre-climax, Climax, Denouement (last quarter of the ingested text book)
    * The story should use the { generated/ approved } topics:
        | Subject | Biological Anchor | Mnemonic Aesthetic | Scent Profile | Genre | MC name | Plot theme | Total Chapters |
        |----|----|----|----|----|----|----|----|
    
    * Uses Jinja2 templates and configurable profiles to generate unique acronyms, visual anchors, and scent profiles for each Chapter, subsection, and key terms within each section.
    * The engine will use the generated contents page or table of contents (if available) to generate the chapter names and to split the book into chapters and subsections, the most likely method will be using the API, but if not the program should be able to do it with font size heuristics and page numbers. 
    * The name of each Chapter is to be generated with the mnemonic engine, and should be a mnemonic for the chapter, the first letter of each word in the mnemonic should spell out the name of the chapter.
    ```
        * Chapter 1: Introduction to Networks [pg.1]
        * C.: 
            1.: (Phonetic)  [Gen. Name for Location and planet]
            I.: 
            T.: 
            N.: 
            [pg.1]
    ```
    * The chapter mnemonic anchors are to be generated as the example for chapter 1 shows:

    ```
    First Things First: What’s a Network? [pg.3]    
    
    • F.: 
      T.: 
      F.: 
      W.: 
      A.: 
      N .: (?) 
      [pg.3]

    • The Local Area Network[pg.4]
        ◦ T.: 
          L.: 
          A.: 
          N.: 
          [pg.4]
    ```     
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

Each text book, for the purpose of this project will be called an "Epoch" and each epoch is assigned a biological Anchortheme and a sensory profile in `book_config.yml` to prevent "memory bleeding":

> [!Note]
> The networking mnemonic is hardcoded for baseline reference. The system will attempt to generate new mnemonics for each new book and will attempt to retain the same aesthetic and genre settings.
> 

| Subject | Biological Anchor | Mnemonic Aesthetic | Scent Profile | Genre | MC name | Plot theme | Total Chapters |
| --- | --- | --- | --- | --- | --- | --- | ---|
| **Networking** {Entry hardcoded for baseline}| Otter/Alien Hybrid | Withering/Decaying | Ambrosia + Ammonia | Space Operetta | Newt | Controlling interstellar networks war for drug runs.  | 25 |
| **Databases** | Insects | Chitinous/Swarming | Ozone + Sulfur | Cyberpunk(tbd) | Draven | Corporate theivery, data theft, social manipulation | 13 |
| **Cybersecurity** | Fungi | Parasitic/Spores | Truffle + Damp Copper | Survival Horror(tbd) | Calyra | Escaping the Hive Mind, discovering self-worth, using the traps setup to conquer the incidents | 20 tbd |
| **Algorithms** | Cephalopods | Shifting/Ink-Cloud | Brine + Iodine | Cosmic Horror(tbd) | [AI genreated mc name based on the startiing letter of the book title with user approval]| [AI genreated plot with user approval]
| **OS** | Arachnids [AI generated/ needs user appoval] | Webbing/Lurking[AI generated/ needs user appoval   ] | Petrichor + Formaldehyde[AI generated/ needs user appoval] | Gothic Horror(tbd) | [AI genreated mc name based on the startiing letter of the book title with user approval]| [AI genreated plot with user approval]
| **etc..**| etc.. | etc.. | etc.. | etc.. | etc... | etc...

## Example Document Generation (Locus View)

> ---
> # Chapter 1: Introduction to Networks
>
>> book: comptia_network_study_guide_exam_n10-008\
>> chapter: introduction-to-networks-01\
```
== Chapter 001 [Original] ==

Chapter 1: Introduction to Networks [pg.1]
First Things First: What’s a Network? [pg.3]
    • The Local Area Network[pg.4]
    • Common Network Components[pg.6]
    • Metropolitan Area Network[pg.9]
    • Wide Area Network[pg. 9]
    • Personal Area Network [pg.10]
    • Campus Area Network [pg. 10]
    • Storage Area Network [pg.10]
    • Software-Defined Wide Area Network [pg.11]
    • Multiprotocol Lable Switching[pg.11]
    • Multiprotocol Generic Routing Encapsulation[pg.12]
    • Network Architecture: Peer-to-Peer or Client-server? [pg.12]
Physical Network Topologies[pg.14]
    • Bus Topology [pg.14]
    • Star Topology [pg.15]
    • Ring Topology[pg.17]
    • Mesh Topology[pg.17]
    • Point-to-Point Tolopology[pg.18]
    • Point-to-Multipoingt Topology[pg.19]
    • Hybrid Topology[pg. 20]
Topology Selection, Backbones, and Segments [pg.21]
    • ​Selecting the Right Topology[pg.22]
    • The Network Backbone[pg.22]
    • Network Segments[pg.23]
    • Service-Relate Entry Points[pg.23]
    • Sevice Provider Links[pg.23]
    • Visual Networking[pg.24]
Summary [ pg.24 ]
Exam Essentials[ pg.25 ]
Review Questions[ pg.26 ]

== Memory Palace Key ==
    • C.: onstant
      1: (Phonetic)  [Gen. Name for Location and planet]
      I.: 
      T.: 
      N.: 
      [pg.1]
    • F.: 
      T.: 
      F.: 
      W.: 
      A.: 
      N .: (?) 
      [pg.3]
        ◦ T.: 
          L.: 
          A.: 
          N.: 
          [pg.4]
        ◦ C.: 
          N.: 
          C.: 
          [pg.6]
        ◦ M.: 
          A.: 
          N.: 
          [pg.9]
        ◦ W.: 
          A.: 
          N.: 
          [pg. 9]
        ◦ P.: 
          A.: 
          N.: 
          [pg.10]
        ◦ C.: 
          A.: 
          N.: 
          [pg. 10]
        ◦ S.: 
          A.: 
          N.: 
          [pg.10]
        ◦ S.: 
          D.: 
          W.: 
          A.: 
          N.: 
          [pg.11]
        ◦ M.: 
          L.: 
          S.: 
          [pg.11]
        ◦ M.: 
          G.: 
          R.: 
          E.: 
          [pg.12]
        ◦ N.: 
          A.: 
          P.: 
          T.: 
          P.: 
          O.: 
          C.: 
          S.: (? )
          [pg.12]
    • P.: 
      N.: 
      T.: 
      [pg.14]
        ◦ B.: 
          T.: 
          [pg.14]
        ◦ S.: 
          T.: 
          [pg.15]
        ◦ R.: 
          T.: 
          [pg.17]
        ◦ M.: 
          T.: 
          [pg.17]
        ◦ P.: 
          T.: 
          P.: 
          T.: 
          [pg.18]
        ◦ P.: 
          T.: 
          M.: 
          T.: 
          [pg.19]
        ◦ H.: 
          T.: 
          [pg. 20]
    • T.: 
      S.: 
      B.: 
      A.: 
      S.: 
      [pg.21]
        ◦ ​S.: 
          T.: 
          R.: 
          T.: 
          [pg.22]
        ◦ T.: 
          N.: 
          B.: 
          [pg.22]
        ◦ N.: 
          S.: 
          [pg.23]
        ◦ S.: 
          R.: 
          E.: 
          P.: 
          [pg.23]
        ◦ S.: 
        ◦ P.: 
        ◦ L.: 
        ◦ [pg.23]
        ◦ V.: 
        ◦ N.: 
        ◦ [pg.24]
    • S.: 
      [ pg.24 ]
    • E.: 
      E.: 
      [ pg.25 ]
    • R.: 
      Q.: 
      [ pg.26 ]
```

>> link : localhost:[port]/data/uploads/{book_name}/Contents/004_Chapters/Chapter_001/[{Pdf filename that matches the chapter number}] 
> ---
> 


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