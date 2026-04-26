import React from 'react'
import '../assets/credits-dialog.css'

interface CreditsDialogProps {
  open: boolean
  onClose: () => void
  variant?: 'main' | 'settings'
}

const CREW: { name: string; desc?: string }[] = [
  { name: 'mula-bb', desc: 'for doing so much work on ApprenticevrSrc' },
  { name: 'George', desc: 'the other half of FranceCut and my best friend' },
  { name: 'fenopy' },
  { name: 'Maxine', desc: 'my VRP people' },
  { name: 'Winsomniac', desc: 'for always having time to test my shit and give good ideas' },
  { name: 'all my ARMGDDN Fam' },
  { name: 'ALT, Decker, Pixeldrew, DankWestern', desc: 'my 3DFF guys who help more than i deserve' },
  { name: 'Pelle', desc: 'for checking in from the other side of the world' },
  { name: 'everyone i met on rin and over the years in this VR shit' }
]

const SEP_FWD = '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'
const SEP_BWD = '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<'

const CreditsDialog: React.FC<CreditsDialogProps> = ({ open, onClose, variant = 'main' }) => {
  if (!open) return null

  const lastLine =
    variant === 'settings' ? 'I love you Mary.' : 'fuck you Mary.'
  const lastLineClass =
    variant === 'settings' ? 'credits-last-line crd-love' : 'credits-last-line crd-fw'

  return (
    <div className="credits-overlay" onClick={onClose}>
      <div className="credits-terminal" onClick={(e) => e.stopPropagation()}>
        <div className="credits-scanlines" />
        <div className="credits-header-bar">
          <span className="credits-terminal-dots">
            <span className="crd-dot red" />
            <span className="crd-dot yellow" />
            <span className="crd-dot green" />
          </span>
          <span className="credits-terminal-title">armgddn_credits_v1.exe</span>
          <button className="credits-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="credits-body">
          <div className="credits-title-line">$P3C|4/_ TH4N|&lt;$</div>
          <div className="credits-subtitle">to my 1337 CREW</div>
          <div className="credits-oder">(in no particular oder)</div>
          <div className="credits-sep">{SEP_FWD}</div>

          <div className="credits-list">
            {CREW.map((member, i) => (
              <div key={i} className="credits-crew-entry">
                <span className="credits-name">{member.name}</span>
                {member.desc && (
                  <span className="credits-desc">// {member.desc}</span>
                )}
              </div>
            ))}
          </div>

          <div className="credits-sep">{SEP_BWD}</div>

          <div className="credits-special-header">{'// SPECIAL THANKS //'}</div>
          <div className="credits-special-text">
            HFP — for teaching me so much even though we aren&apos;t tight anymore.
            <br />
            i probably would be doing something a lot more boring if it wasn&apos;t for him.
            <br />
            <br />
            Rod — my crazy friend who believes in megalodons on Mars
            <br />
            and gave me such good feedback on VR CyberDeck.
          </div>

          <div className="credits-sep">{SEP_FWD}</div>

          <div className={lastLineClass}>{lastLine}</div>
          <div className="credits-cursor">█</div>
        </div>
      </div>
    </div>
  )
}

export default CreditsDialog
