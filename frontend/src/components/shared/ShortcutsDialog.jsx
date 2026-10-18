import { Keyboard } from 'lucide-react'
import { useUiStore } from '../../stores/ui.store.js'
import { MOD } from '../../hooks/useHotkeys.js'
import { Dialog } from '../ui/Dialog.jsx'
import { Kbd } from '../ui/Kbd.jsx'

const GROUPS = [
  { title: 'Général', items: [
    [[MOD, 'K'], 'Rechercher / palette de commandes'],
    [['?'], 'Afficher les raccourcis'],
    [['['], 'Réduire / agrandir la barre latérale'],
    [['U'], 'Importer des fichiers'],
    [['N'], 'Nouveau dossier'],
    [['/'], 'Filtrer le dossier courant'],
  ] },
  { title: 'Explorateur', items: [
    [['←', '↑', '→', '↓'], 'Se déplacer entre les éléments'],
    [['Maj', '↓'], 'Étendre la sélection'],
    [[MOD, 'A'], 'Tout sélectionner'],
    [['↵'], 'Ouvrir'],
    [['Espace'], 'Aperçu rapide'],
    [['F2'], 'Renommer'],
    [['M'], 'Déplacer vers…'],
    [['F'], 'Ajouter / retirer des favoris'],
    [['I'], 'Informations'],
    [['Suppr'], 'Mettre à la corbeille'],
    [[MOD, 'C'], 'Copier le lien public'],
    [['V'], 'Basculer grille / liste'],
    [['Ctrl', 'Molette'], 'Taille des vignettes (ou pincer le pavé tactile)'],
    [['Échap'], 'Tout désélectionner'],
  ] },
  { title: 'Visionneuse', items: [
    [['←', '→'], 'Média précédent / suivant (ou balayage deux doigts)'],
    [['+', '−', '0'], 'Zoom avant / arrière / réinitialiser'],
    [['Espace'], 'Lecture / pause (vidéo)'],
    [['S'], 'Diaporama'],
    [['I'], "Panneau d'informations"],
    [['D'], 'Télécharger'],
    [['Échap'], 'Fermer'],
  ] },
  { title: 'Souris et pavé tactile', items: [
    [['Clic droit'], 'Menu contextuel (fichier, dossier, fond, sélection)'],
    [['Double-clic'], 'Ouvrir'],
    [[MOD, 'Clic'], 'Ajouter / retirer de la sélection'],
    [['Maj', 'Clic'], 'Sélectionner une plage'],
    [['Glisser'], 'Sélection au lasso (sur le fond) ou déplacement (sur un élément)'],
    [['Pincer'], 'Taille des vignettes / zoom dans la visionneuse'],
  ] },
]

export default function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useUiStore()
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} title="Raccourcis clavier" description="Gagnez du temps au clavier, à la souris et au pavé tactile." icon={Keyboard} size="xl">
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">{g.title}</p>
            <div className="divide-y divide-line rounded-xl border border-line">
              {g.items.map(([keys, label]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[13px] text-muted">{label}</span>
                  <span className="flex shrink-0 items-center gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
