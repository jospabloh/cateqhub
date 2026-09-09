import { useAuth } from "@/lib/AuthContext";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import IdleWarningDialog from "@/components/IdleWarningDialog";
import SessionExpiredDialog from "@/components/SessionExpiredDialog";

// Mitad propia de esta app del módulo 20. Los cuatro archivos de shared/session/
// (los dos hooks y los dos diálogos) son idénticos byte a byte en todo el
// portafolio y no se tocan; esto es sólo dónde se montan y con qué inquilino.
//
// El corte por `user` es la razón de que exista este envoltorio: useSessionManager
// llama al backend en cuanto monta, y montarlo en la raíz haría que cada visitante
// anónimo de /login pidiera una sesión que no tiene. Las reglas de hooks impiden
// llamarlos condicionalmente, así que la condición vive en el componente de
// fuera y los hooks en el de dentro, que sólo se monta con sesión.
function SessionControlInner({ parishId }) {
  const { idleState, sessionExpired, continueSession } = useSessionManager();
  // El identificador de inquilino de esta app es parish_id. El hook no hace
  // nada hasta tenerlo, así que pasarlo vacío durante el primer render es seguro.
  useActivityTracker(parishId);

  return (
    <>
      <IdleWarningDialog open={idleState === "idle_warning"} onContinue={continueSession} />
      <SessionExpiredDialog open={sessionExpired} />
    </>
  );
}

export default function SessionControl() {
  const { user } = useAuth();
  if (!user) return null;
  return <SessionControlInner parishId={user.parish_id} />;
}
