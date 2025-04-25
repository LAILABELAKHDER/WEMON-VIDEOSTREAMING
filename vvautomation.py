#!/usr/bin/env python3
import sys
import subprocess
import random
from selenium import webdriver
from time import sleep
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
import pyautogui
import urllib.parse
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Vérification des arguments
if len(sys.argv) != 2:
    print("Usage: python script.py <scenario_value>")
    sys.exit(1)
scenario = sys.argv[1]

# Configuration Chrome
chrome_options = webdriver.ChromeOptions()
chrome_options.add_argument('--disable-gpu')
chrome_options.add_argument('--disable-software-rasterizer')
chrome_options.add_argument('--disable-search-engine-choice-screen')
chrome_options.add_argument('--ignore-certificate-errors')
chrome_options.add_argument('--disable-popup-blocking')
chrome_options.add_argument('--disable-notifications')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
driver.set_page_load_timeout(100)
action = ActionChains(driver)

# Chargement initial
driver.get("https://www.google.com")
sleep(3)

def encode_url(url):
    base_part = 'http://10.0.0.2/'
    if url.startswith(base_part):
        rest_of_url = url[len(base_part):]
        encoded_url = urllib.parse.quote(rest_of_url, safe=':/')
        return base_part + encoded_url
    return url

# Chargement du player
player_url = "http://10.0.0.2/player.html"
full_url = encode_url(player_url) + "?scenario=" + scenario
driver.get(full_url)
sleep(1)

print("Veuillez cliquer manuellement sur le bouton Play dans le navigateur...")

try:
    # Attendre que la vidéo soit chargée et jouable
    video_element = WebDriverWait(driver, 300).until(
        EC.presence_of_element_located((By.TAG_NAME, 'video'))
    )
    
    # Attendre le démarrage manuel par l'utilisateur
    WebDriverWait(driver, 300).until(
        lambda d: d.execute_script("return arguments[0].currentTime > 0", video_element)
    )
    print("Lecture de la vidéo détectée...")

    # Surveiller la fin de la vidéo
    WebDriverWait(driver, 86400).until(  # Timeout de 24h max
        lambda d: d.execute_script("return arguments[0].ended", video_element)
    )
    print("Vidéo terminée avec succès")

except Exception as e:
    print("Erreur pendant la lecture:", e)

# Nettoyage du cache
driver.execute_cdp_cmd('Network.clearBrowserCache', {})
driver.execute_cdp_cmd('Network.clearBrowserCookies', {})

input("Appuyez sur Entrée pour fermer le navigateur...")
driver.quit()
