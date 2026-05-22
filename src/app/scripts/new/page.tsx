import { PageHeader } from "@/components/shared/page-header";
import { ScriptBuilder } from "@/components/scripts/script-builder";

export default function NewScriptPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="New Script"
        title="Create a script"
        description="Build a local placeholder script, validate the basic shape, and import or export JSON while persistence remains browser-only."
      />

      <ScriptBuilder />
    </div>
  );
}
