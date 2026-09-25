import { RecordForm } from "./form";

export default function NuevaActividadPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-fluid-3xl text-balance tracking-tight text-primary">Agregar actividad</h1>
      <RecordForm />
    </div>
  );
}
