import os
import sys

def lister_fichiers(dossier, recursif=True):
    fichiers = []
    if recursif:
        for racine, _, fichiers_liste in os.walk(dossier):
            for fichier in fichiers_liste:
                nom, extension = os.path.splitext(fichier)
                fichiers.append((nom, extension))
    else:
        for fichier in os.listdir(dossier):
            chemin_complet = os.path.join(dossier, fichier)
            if os.path.isfile(chemin_complet):
                nom, extension = os.path.splitext(fichier)
                fichiers.append((nom, extension))
    return fichiers

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Utilisation : python mon_script.py <chemin_du_dossier>")
        sys.exit(1)

    dossier_projet = sys.argv[1]

    if not os.path.isdir(dossier_projet):
        print(f"Erreur : '{dossier_projet}' n'est pas un dossier valide.")
        sys.exit(1)

    resultat = lister_fichiers(dossier_projet)

    for nom, ext in resultat:
        print(f"Nom : {nom}, Extension : {ext}")