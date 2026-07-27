// Versión del aviso de manejo de datos sensibles. Súbela cada vez que cambie
// el contenido de DATA_PROCESSING_NOTICE — un cambio de versión no re-pide
// aceptación a parroquias existentes automáticamente (esa función queda
// fuera de alcance por ahora; solo aplica a parroquias nuevas).
//
// NOTA: Base44 functions (base44/functions/*/entry.ts) no pueden importar de
// src/, así que create_parish (base44/functions/create_parish/entry.ts)
// declara su propia copia de este valor. Si cambias esta constante, cambia
// también la de create_parish/entry.ts en el mismo commit.
export const DATA_PROCESSING_TERMS_VERSION = "2026-07-23";

export const DATA_PROCESSING_NOTICE = [
  {
    heading: "Qué datos recabas en CateqHub",
    body: "CateqHub te permite registrar datos de niñas, niños y adolescentes inscritos en catecismo, incluyendo su CURP, nombre completo y fecha de nacimiento, así como datos de sus tutores. Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento, los datos de menores de edad y la CURP se consideran información sensible y requieren un manejo cuidadoso.",
  },
  {
    heading: "Quién es responsable de estos datos",
    body: "Tu parroquia es la responsable (quien decide qué datos se recaban y para qué) de la información que cargas en CateqHub. CateqHub, operado sobre la infraestructura de Base44, actúa como encargado (quien trata los datos por cuenta de la parroquia, siguiendo sus instrucciones).",
  },
  {
    heading: "Tu obligación como responsable",
    body: "Antes de registrar los datos de un niño o niña en la plataforma, tu parroquia debe haber obtenido el consentimiento de su padre, madre o tutor (por ejemplo, en la hoja de inscripción física al catecismo) — este consentimiento en pantalla lo aceptas tú como administrador de la parroquia, y no sustituye el consentimiento que debes recabar de cada familia.",
  },
  {
    heading: "Para qué se usan estos datos",
    body: "Únicamente para llevar el control de asistencia, grupos y catecismo dentro de tu parroquia. CateqHub no vende ni comparte estos datos con terceros para fines distintos.",
  },
  {
    heading: "Derechos ARCO",
    body: "Las familias pueden solicitar a tu parroquia acceder, rectificar o cancelar los datos de sus hijos, u oponerse a su tratamiento, en cualquier momento — como responsable, tu parroquia debe poder atender esas solicitudes (editar/eliminar los registros correspondientes desde CateqHub).",
  },
  {
    heading: "Retención y eliminación",
    body: "Los datos del núcleo gratuito (niños, grupos, asistencia) permanecen mientras tu parroquia use la plataforma. Los datos de Tutores (función Premium) siguen las reglas del ciclo de vida de la licencia: si el pago de Premium no se confirma, primero se restringe la edición, después el acceso completo, y solo se eliminan tras haber tenido oportunidad de exportarlos — nunca de forma automática sin ese paso.",
  },
];

export const DATA_PROCESSING_ACCEPTANCE_TEXT =
  "Acepto que mi parroquia es responsable del manejo de estos datos conforme a la LFPDPPP, que cuento con el consentimiento de los padres/tutores para registrar los datos de cada niño o niña, y entiendo el ciclo de solo lectura → acceso denegado → exportación → eliminación aplicable a la función Premium.";
