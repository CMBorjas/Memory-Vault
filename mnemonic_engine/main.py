import os
import yaml
import logging

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_config(config_path="book_config.yml"):
    """Loads the book configuration defining mnemonic rules."""
    if not os.path.exists(config_path):
        logger.warning(f"Configuration file not found at {config_path}")
        return {}
    
    with open(config_path, "r") as file:
        try:
            return yaml.safe_load(file)
        except yaml.YAMLError as exc:
            logger.error(f"Error parsing YAML config: {exc}")
            return {}

def process_vault(vault_path="/vault"):
    """Scans the vault for markdown files and applies mnemonic processing."""
    logger.info(f"Starting mnemonic processing on vault at: {vault_path}")
    
    if not os.path.exists(vault_path):
        logger.error(f"Vault path does not exist: {vault_path}")
        return

    # Basic directory traversal as a placeholder
    for root, _, files in os.walk(vault_path):
        for file in files:
            if file.endswith(".md"):
                file_path = os.path.join(root, file)
                logger.info(f"Discovered: {file_path}")
                # TODO: Implement markdown parsing and mnemonic injection logic here

if __name__ == "__main__":
    logger.info("Initializing Anti-Gravity Mnemonic Engine...")
    
    # In the future, config and vault paths will likely be injected via environment variables or docker volumes
    config = load_config()
    if config:
        logger.info(f"Loaded configuration for {len(config.keys())} book(s).")
    
    # Assuming the vault is mounted to /vault in the container
    process_vault()
    
    logger.info("Mnemonic processing complete.")
