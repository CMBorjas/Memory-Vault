
---

# Project: Anti-Gravity Knowledge Engine (AGKE) for CS Notes in review. Formated for Obsidian. 

**Anti-Gravity** is a containerized, horizontally scalable knowledge ecosystem designed to bridge the gap between "Cold Data" (University OneDrive/GDrive) and "Living Knowledge" (Grotesque Mnemonics & Sensory Anchors).

## 🧩 The Core Philosophy: "Dissonance for Retention"

Standard wikis fail because they are "clean." AGKE succeeds by being **grotesque**. By utilizing sensory dissonance—clashing sweet ambrosia with caustic ammonia—we anchor technical CS concepts (like WANs) into long-term biological storage.

### The "Sanitizer" Protocol

The system maintains a dual-state:

1. **Locus View:** The grotesque, mnemonic-rich study mode.
2. **Sanitized View:** A professional, production-ready export for portfolios/sharing, purged of all "disturbing" imagery or refrence to the mnemonic anchors.

---

## 🏗 Architecture & Scaling

### 1. The Data Pipeline

* **Source:** University OneDrive (Transitioned via `rclone`).
* **Hub:** Google Drive (Primary Cloud Redundancy).
* **Persistence:** Local NAS (NFS/SMB volumes) + Garuda Desktop.

### 2. Horizontal Scaling

The engine is built to scale across nodes using **Docker & GitHub Container Registry (GHCR)**.

* **Frontend:** Stateless Markdown renderers.
* **Mnemonic Engine:** A Python-based sidecar service that injects mnemonics based on `book_config.yml`.
* **Deployment:** `docker-compose up --scale engine=3` to handle heavy indexing/conversion loads.

---

## 🛠 Tech Stack

* **OS:** Garuda Linux (Arch-based) for development and terminal orchestration.
* **Cloud CLI:** `rclone` for cross-provider data distribution.
* **Engine:** Docker & Docker Compose for containerization.
* **Wiki Core:** Obsidian (local) / Wiki.js (containerized).
* **Sync:** Syncthing (P2P redundancy between Desktop and NAS).

---

## 🧠 Book-Scale Mnemonic Reasoning

Each book/module in the vault is assigned a biological kingdom and a sensory profile to prevent "memory bleeding":

| Book/Module | Biological Anchor | Mnemonic Aesthetic | Scent Profile |
| --- | --- | --- | --- |
| **Networking** | Amphibians | Withering/Decaying | Ambrosia + Ammonia |
| **Databases** | Insects | Chitinous/Swarming | Ozone + Sulfur |
| **Cybersecurity** | Fungi | Parasitic/Spores | Truffle + Damp Copper |

> ### 🧪 Example: Wide Area Networks (WAN)
> 
> 
> **Mnemonic:** Withering Ambrosia Newts.
> **Visual:** Translucent amphibians bridging continents; skin tearing like rotting lilies.
> **Sensory:** The sweetness of funeral flowers fighting the eye-stinging stench of a lizard tank.

---

## 🚀 Deployment (Anti-Gravity Protocol)

1. **Clone the blueprint:**
```bash
git clone https://github.com/hyro_antares/anti-gravity.git

```


2. **Initialize Data Distribution:**

```bash
   # Sync OneDrive to GDrive via Rclone
   rclone copy oneDrive: gdrive:University_Archive --progress

```

3. **Launch the Engine:**
```bash
docker-compose up -d

```



---

## 🛡️ No Single Point of Failure (SPOF)

This project adheres to the **3-2-1-0 Rule**:

* **3** Copies of data (Cloud, NAS, Desktop).
* **2** Different media (SSD, HDD).
* **1** Off-site (Google Drive).
* **0** Errors (Verified via Rclone checksums).

---

### What's Next for the "Anti-Gravity" Build?

Now that we have the manifesto, do you want to:

1. Build the **Dockerfile** for the "Mnemonic Sidecar" that will actually process the books?
Yes, the mnemonic sidecar should process the markdown files. I have Onenote files that would need to have priority since I would like to keep their original integrity. I would like them to be separated into different files based on chapters, and subjects within the chapters. 

2. Set up the **GitHub Action** to automate the "Sanitized" build whenever you push a change?
    No, the sanitized version is only to be used for interviews and sharing with others, not for my personal study. The mnemonic anchors are an integral part of the user to create. It should be based on the user's personal experiences and memories, making it unique to them. That is what I want to study. The general mnemonic system outcomes can create weird visions keeping to the anchor aesthetics of the book. Based on the how the user feels about the first mnemonic feeling of the title, or from a randomized generator for a mnemonic. 


```

```