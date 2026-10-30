import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import {
  normalizeLearning,
  learningModels,
  type LearningSpec,
} from "../../sidecar/learning.mjs";
const labels: Record<string, string> = {
  side: "Sisi (cm)",
  width: "Panjang (cm)",
  height: "Tinggi (cm)",
  depth: "Lebar / panjang prisma (cm)",
  base: "Alas (cm)",
  top: "Sisi atas (cm)",
  offset: "Geser mendatar (cm)",
  radius: "Jari-jari (cm)",
  diagonal1: "Diagonal 1 (cm)",
  diagonal2: "Diagonal 2 (cm)",
  numerator: "Pembilang",
  denominator: "Penyebut",
  minimum: "Batas kiri",
  maximum: "Batas kanan",
  value: "Nilai",
  pointX: "Koordinat x",
  pointY: "Koordinat y",
  parts: "Bagian / urutan (satu per baris)",
  word: "Kata",
  words: "Kosakata (satu per baris)",
  relation: "Hubungan makna",
  idea: "Ide pokok",
  details: "Rincian pendukung (satu per baris)",
  labels: "Kategori (satu per baris)",
  values: "Nilai (satu per baris)",
  degrees: "Sudut (derajat)",
  sides: "Jumlah sisi",
  rows: "Jumlah baris",
  columns: "Jumlah kolom",
  number: "Bilangan",
  first: "Bagian pertama",
  second: "Bagian kedua",
  hour: "Jam",
  minute: "Menit",
  coefficient: "Koefisien x",
  constant: "Konstanta",
  answer: "Nilai x",
  left: "Nama himpunan kiri",
  right: "Nama himpunan kanan",
  leftOnly: "Anggota kiri saja",
  both: "Anggota irisan",
  rightOnly: "Anggota kanan saja",
  marks: "Tanda akhir (satu per baris)",
  root: "Kata dasar",
  prefix: "Awalan",
  suffix: "Akhiran",
  result: "Kata hasil",
  cause: "Sebab",
  effect: "Akibat",
  connector: "Kata penghubung",
  character: "Tokoh",
  setting: "Latar",
  problem: "Masalah",
  solution: "Penyelesaian",
  groups: "Jumlah kelompok",
  perGroup: "Benda per kelompok",
  multiplier: "Faktor pengali",
  legA: "Sisi siku-siku a (cm)",
  legB: "Sisi siku-siku b (cm)",
  slope: "Gradien m",
  intercept: "Titik potong y",
  quadraticA: "Koefisien kuadrat a (bukan nol)",
  vertexX: "Puncak x (h)",
  vertexY: "Puncak y (k)",
  favorable: "Bola kuning",
  total: "Total bola",
  vectorAX: "Vektor A: x",
  vectorAY: "Vektor A: y",
  vectorBX: "Vektor B: x",
  vectorBY: "Vektor B: y",
};
export function LearningFields({
  value,
  onChange,
  disabled = false,
}: {
  value: LearningSpec;
  onChange: (value: LearningSpec) => void;
  disabled?: boolean;
  allowModelChange?: boolean;
}) {
  const [draft, setDraft] = useState<LearningSpec>(value),
    [error, setError] = useState("");
  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value]);
  const model = learningModels[draft.kind];
  function apply(next: LearningSpec) {
    setDraft(next);
    try {
      const valid = normalizeLearning(next);
      onChange(valid);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <fieldset disabled={disabled} className="science-fields">
      {Object.entries(model.defaults).map(([key, initial]) => (
        <div className="generate-field" key={`${draft.kind}-${key}`}>
          <Label htmlFor={`learning-${key}`}>{labels[key] || key}</Label>
          {typeof initial === "number" ? (
            <NumberField
              label={labels[key] || key}
              value={draft[key] as number}
              min={model.ranges[key][0]}
              max={model.ranges[key][1]}
              step={model.integers?.includes(key) ? 1 : 0.1}
              onChange={(number) => apply({ ...draft, [key]: number })}
            />
          ) : Array.isArray(initial) ? (
            <Textarea
              id={`learning-${key}`}
              aria-label={labels[key] || key}
              rows={3}
              value={(draft[key] as (string | number)[]).join("\n")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  [key]:
                    key === "values"
                      ? e.target.value.split("\n").map(Number)
                      : e.target.value.split("\n"),
                })
              }
            />
          ) : (
            <Input
              id={`learning-${key}`}
              value={draft[key] as string}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          )}
        </div>
      ))}
      {Object.values(model.defaults).some((v) => typeof v !== "number") && (
        <Button type="button" disabled={disabled} onClick={() => apply(draft)}>
          Apply diagram text
        </Button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
