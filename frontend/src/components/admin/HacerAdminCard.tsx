import { useState } from 'react'
import { useHacerAdmin, useQuitarAdmin } from '@/api/hooks'
import { FormattedErrorMessage } from '@/lib/formatErrorMessage'
import AdminCardHeader from './AdminCardHeader'
import { resultText } from './AdminActionRow'

export default function HacerAdminCard() {
  const hacerAdmin = useHacerAdmin()
  const quitarAdmin = useQuitarAdmin()
  const [usernameOEmail, setUsernameOEmail] = useState('')

  const pending = hacerAdmin.isPending || quitarAdmin.isPending
  const error = hacerAdmin.error ?? quitarAdmin.error

  const handleHacerAdmin = () => {
    if (!usernameOEmail.trim()) return
    quitarAdmin.reset()
    hacerAdmin.mutate(usernameOEmail.trim())
  }

  const handleQuitarAdmin = () => {
    if (!usernameOEmail.trim()) return
    hacerAdmin.reset()
    quitarAdmin.mutate(usernameOEmail.trim())
  }

  return (
    <div className="card">
      <AdminCardHeader
        titulo="Rol de administrador"
        descripcion="Otorga o revoca el rol de administrador de otro usuario, identificándolo por su username o email."
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="field-input w-56"
            placeholder="Username o email"
            value={usernameOEmail}
            onChange={(e) => setUsernameOEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={handleHacerAdmin}
            disabled={pending || !usernameOEmail.trim()}
            className="btn-primary w-fit"
          >
            {hacerAdmin.isPending ? 'Otorgando…' : 'Hacer administrador'}
          </button>
          <button
            type="button"
            onClick={handleQuitarAdmin}
            disabled={pending || !usernameOEmail.trim()}
            className="btn-secondary w-fit"
          >
            {quitarAdmin.isPending ? 'Quitando…' : 'Quitar administrador'}
          </button>
        </div>
        {hacerAdmin.data && (
          <p className={resultText}>
            <span className="font-semibold text-navy-950">{hacerAdmin.data.username}</span> ({hacerAdmin.data.email}) ahora es administrador.
          </p>
        )}
        {quitarAdmin.data && (
          <p className={resultText}>
            A <span className="font-semibold text-navy-950">{quitarAdmin.data.username}</span> ({quitarAdmin.data.email}) se le quitó el rol de administrador.
          </p>
        )}
        {error && (
          <div className="banner-danger">
            <FormattedErrorMessage text={error.message} />
          </div>
        )}
      </div>
    </div>
  )
}
