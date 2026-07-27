// Versión del aviso de manejo de datos sensibles. Súbela cada vez que cambie
// el contenido de DATA_PROCESSING_NOTICE — un cambio de versión no re-pide
// aceptación a parroquias existentes automáticamente (esa función queda
// fuera de alcance por ahora; solo aplica a parroquias nuevas).
//
// NOTA: Base44 functions (base44/functions/*/entry.ts) no pueden importar de
// src/, así que create_parish (base44/functions/create_parish/entry.ts)
// declara su propia copia de este valor. Si cambias esta constante, cambia
// también la de create_parish/entry.ts en el mismo commit.
export const DATA_PROCESSING_TERMS_VERSION = "2026-07-27";

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
    body: "Los datos del plan Gratis (niños, grupos, asistencia) permanecen sin vencimiento mientras tu parroquia use la plataforma, hasta el tope de niños activos del plan. Toda parroquia nueva arranca con 30 días de acceso Premium completo, sin costo; si tu parroquia supera ese tope y el período de prueba o de pago no se renueva, primero se restringe la edición en toda la app (niños, grupos, asistencia y Tutores) y después el acceso completo. Solo los datos de Tutores (función Premium) llegan a eliminarse, y únicamente tras haber tenido oportunidad de exportarlos — nunca de forma automática sin ese paso. Los datos de niños, grupos y asistencia nunca se eliminan por falta de pago.",
  },
];

export const DATA_PROCESSING_ACCEPTANCE_TEXT =
  "Acepto que mi parroquia es responsable del manejo de estos datos conforme a la LFPDPPP, que cuento con el consentimiento de los padres/tutores para registrar los datos de cada niño o niña, y entiendo que mi parroquia tiene 30 días de prueba Premium y que, si mi parroquia supera el tope de niños del plan Gratis y el período de prueba o pago no se renueva, aplica el ciclo de solo lectura → acceso denegado → exportación → eliminación (este último paso, solo para los datos de Tutores).";
