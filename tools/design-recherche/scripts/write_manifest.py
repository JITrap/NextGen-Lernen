#!/usr/bin/env python3
import json, os
from PIL import Image

BASE = "/home/user/NextGen-Lernen/tools/design-recherche"

items_meta = [
 {"nr":1,"kategorie":"Autos/Motorsport","motiv":"Glaenzender klassischer Oldtimer, Frontpartie","quelle_url":"https://commons.wikimedia.org/wiki/File:Shiny_Vintage_Car_(Unsplash).jpg","fotograf":"Serge Kutuzov (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":2,"kategorie":"Autos/Motorsport","motiv":"Weisser Oldtimer, Seitenansicht","quelle_url":"https://commons.wikimedia.org/wiki/File:White_vintage_car_(Unsplash).jpg","fotograf":"bady qb (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":3,"kategorie":"Autos/Motorsport","motiv":"Detailaufnahme Scheinwerfer Oldtimer","quelle_url":"https://commons.wikimedia.org/wiki/File:Vintage_car_headlight_(Unsplash).jpg","fotograf":"Dominik Martin (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":4,"kategorie":"Autos/Motorsport","motiv":"Lenkrad/Armaturenbrett Oldtimer, Detail","quelle_url":"https://commons.wikimedia.org/wiki/File:Vintage_steering_wheel_(Unsplash).jpg","fotograf":"Dahan Remy (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":5,"kategorie":"Autos/Motorsport","motiv":"Klassisches Motorrad in malerischer Landschaft","quelle_url":"https://commons.wikimedia.org/wiki/File:Scenic_motorcycle_(Unsplash).jpg","fotograf":"Francisco Requena (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":6,"kategorie":"Autos/Motorsport","motiv":"Rennwagen-Cockpit/Ueberrollkaefig, Motorsport-Vibe","quelle_url":"https://commons.wikimedia.org/wiki/File:Race_car_roll_cage_(Unsplash).jpg","fotograf":"Lloyd Dirks (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":7,"kategorie":"Landschaft/Sonnenuntergang/Kueste","motiv":"'The Fighting Temeraire' - Schiff im Sonnenuntergang (Gemaelde)","quelle_url":"https://commons.wikimedia.org/wiki/File:The_Fighting_Temeraire,_JMW_Turner,_National_Gallery.jpg","fotograf":"J.M.W. Turner, ca. 1839 (National Gallery London)","lizenz":"Public Domain"},
 {"nr":8,"kategorie":"Landschaft/Sonnenuntergang/Kueste","motiv":"'Twilight in the Wilderness' - dramatischer Sonnenuntergang (Gemaelde)","quelle_url":"https://commons.wikimedia.org/wiki/File:Frederic_Edwin_Church_-_Twilight_in_the_Wilderness.jpg","fotograf":"Frederic Edwin Church, 1860 (Cleveland Museum of Art)","lizenz":"Public Domain"},
 {"nr":9,"kategorie":"Landschaft/Sonnenuntergang/Kueste","motiv":"Felsige Kueste im Sonnenuntergang","quelle_url":"https://commons.wikimedia.org/wiki/File:Ocean_cliff_sunset_(Unsplash).jpg","fotograf":"Sweet Ice Cream Photography (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":10,"kategorie":"Landschaft/Sonnenuntergang/Kueste","motiv":"Ozean-Horizont im Sonnenuntergang","quelle_url":"https://commons.wikimedia.org/wiki/File:Ocean_sunset_(Unsplash).jpg","fotograf":"Cody Weiher (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":11,"kategorie":"Landschaft/Sonnenuntergang/Kueste","motiv":"Palmen am Strand im Sonnenuntergang (Venice Beach)","quelle_url":"https://commons.wikimedia.org/wiki/File:Venice_Beach_palm_trees_at_sunset_(Unsplash).jpg","fotograf":"Stuart Guest-Smith (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":12,"kategorie":"Landschaft/Sonnenuntergang/Kueste","motiv":"Berglandschaft in goldenem Licht","quelle_url":"https://commons.wikimedia.org/wiki/File:Golden_mountain_(Unsplash).jpg","fotograf":"Anton Repponen (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":13,"kategorie":"Architektur/Stadt (Mediterran/Riviera)","motiv":"'Villas at Bordighera' - italienische Riviera-Architektur (Gemaelde)","quelle_url":"https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Villas_%C3%A0_Bordighera.jpg","fotograf":"Claude Monet, 1884 (Israel Museum)","lizenz":"Public Domain"},
 {"nr":14,"kategorie":"Architektur/Stadt (Mediterran/Riviera)","motiv":"'Le Grand Canal' Venedig (Gemaelde)","quelle_url":"https://commons.wikimedia.org/wiki/File:Claude_Monet,_Le_Grand_Canal.jpg","fotograf":"Claude Monet, 1908 (Museum of Fine Arts, Boston)","lizenz":"Public Domain"},
 {"nr":15,"kategorie":"Architektur/Stadt (Mediterran/Riviera)","motiv":"Positano an der Amalfikueste im Sonnenuntergang","quelle_url":"https://commons.wikimedia.org/wiki/File:Positano%27s_sunset_(Unsplash).jpg","fotograf":"Ricardo Gomez Angel (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":16,"kategorie":"Architektur/Stadt (Mediterran/Riviera)","motiv":"Santorini - weisse Haeuser und blaue Kuppeln","quelle_url":"https://commons.wikimedia.org/wiki/File:Santorini,_Greece_(Unsplash_tjA0Dm7c7c8).jpg","fotograf":"Aidan Meyer (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":17,"kategorie":"Stillleben/Objekte","motiv":"'Still Life with Oysters, a Silver Tazza, and Glassware' (Gemaelde)","quelle_url":"https://www.metmuseum.org/art/collection/search/438376","fotograf":"Willem Claesz Heda, 1635 (The Metropolitan Museum of Art)","lizenz":"Public Domain (Met Open Access)"},
 {"nr":18,"kategorie":"Stillleben/Objekte","motiv":"'The Brioche' - Brot, Frucht, Wein (Gemaelde)","quelle_url":"https://www.metmuseum.org/art/collection/search/436946","fotograf":"Edouard Manet, 1870 (The Metropolitan Museum of Art)","lizenz":"Public Domain (Met Open Access)"},
 {"nr":19,"kategorie":"Stillleben/Objekte","motiv":"Kaffee/Espresso wird eingeschenkt","quelle_url":"https://commons.wikimedia.org/wiki/File:Passion_Pour_(Unsplash).jpg","fotograf":"Nathan Dumlao (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":20,"kategorie":"Stillleben/Objekte","motiv":"Weinglas Nahaufnahme (Champagner-Vibe)","quelle_url":"https://commons.wikimedia.org/wiki/File:Wine_glass_from_up_close_(Unsplash).jpg","fotograf":"Markus Spiske (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":21,"kategorie":"Figuren ohne Gesicht","motiv":"'Wanderer ueber dem Nebelmeer' - Ruecken-Silhouette (Gemaelde)","quelle_url":"https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg","fotograf":"Caspar David Friedrich, 1818 (Kunsthalle Hamburg)","lizenz":"Public Domain"},
 {"nr":22,"kategorie":"Figuren ohne Gesicht","motiv":"'Frau am Fenster' - Ruecken-Silhouette (Gemaelde)","quelle_url":"https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Frau_am_Fenster_-_Google_Art_Project.jpg","fotograf":"Caspar David Friedrich, 1822 (Alte Nationalgalerie Berlin)","lizenz":"Public Domain"},
 {"nr":23,"kategorie":"Figuren ohne Gesicht","motiv":"Frau von hinten am Meer im Sonnenuntergang","quelle_url":"https://commons.wikimedia.org/wiki/File:Woman_by_ocean_sunset_(Unsplash).jpg","fotograf":"Jeremy Bishop (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":24,"kategorie":"Figuren ohne Gesicht","motiv":"Silhouette Surfer im Sonnenuntergang","quelle_url":"https://commons.wikimedia.org/wiki/File:Silhouette_surfer_at_sunset_(Unsplash).jpg","fotograf":"Rafael Leao (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":25,"kategorie":"Tiere","motiv":"'Whistlejacket' - sich aufbaeumendes Pferd (Gemaelde)","quelle_url":"https://commons.wikimedia.org/wiki/File:Whistlejacket_by_George_Stubbs_edit.jpg","fotograf":"George Stubbs, ca. 1762 (National Gallery London)","lizenz":"Public Domain (PD-old-100, CC-PD-Mark)"},
 {"nr":26,"kategorie":"Tiere","motiv":"Weisses Pferd, Island","quelle_url":"https://commons.wikimedia.org/wiki/File:White_horse_in_Iceland_(Unsplash).jpg","fotograf":"Melissa Regina (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":27,"kategorie":"Tiere","motiv":"Leopard ruht auf einem Baum","quelle_url":"https://commons.wikimedia.org/wiki/File:Leopard_resting_by_a_tree_(Unsplash).jpg","fotograf":"Himesh Kumar Behera (Unsplash, via Wikimedia Commons)","lizenz":"CC0 1.0"},
 {"nr":28,"kategorie":"Tiere","motiv":"'A Whippet' - Windhund-Portrait (Gemaelde)","quelle_url":"https://commons.wikimedia.org/wiki/File:A_Whippet_-_William_Weaver_Baker_-_313-1977-332.png","fotograf":"William Weaver Baker (Yale Center for British Art)","lizenz":"Public Domain"},
]

downloads_dir = os.path.join(BASE, "downloads")
files_by_nr = {}
for f in os.listdir(downloads_dir):
    nr = int(f.split("-")[0])
    files_by_nr[nr] = f

manifest = []
for item in items_meta:
    nr = item["nr"]
    fname = files_by_nr[nr]
    im = Image.open(os.path.join(downloads_dir, fname))
    w, h = im.size
    manifest.append({
        "nr": nr,
        "datei": f"downloads/{fname}",
        "breite_px": w,
        "hoehe_px": h,
        "quelle-url": item["quelle_url"],
        "fotograf": item["fotograf"],
        "lizenz": item["lizenz"],
        "kategorie": item["kategorie"],
        "motiv-kurz": item["motiv"],
    })

manifest.sort(key=lambda x: x["nr"])
out_path = os.path.join(BASE, "manifest.json")
with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=2, ensure_ascii=False)

print(f"Wrote {out_path} with {len(manifest)} entries")
