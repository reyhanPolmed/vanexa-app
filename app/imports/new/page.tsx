import Link from "next/link";
import { requireHost } from "@/lib/auth";
import { UploadForm } from "../upload-form";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";

const template = `VANEXA-PDF-V1
CATEGORY: TIU
BANK: Latihan saya

QUESTION: 1
TYPE: SINGLE_CORRECT
PROMPT:
Berapakah jumlah 2 dan 3?
A: 4
B: 5
C: 6
D: 7
E: 8
KEY: B
EXPLANATION:
Dua ditambah tiga sama dengan lima.
---END---`;

export default async function NewImportPage() {
  const host = await requireHost("/imports/new");
  return <><SiteHeader host={host} active="banks" /><main className="page-width flex-1 py-10">
    <Link className="text-link" href="/banks">← Bank soal pribadi</Link>
    <p className="eyebrow mt-10">SIAPKAN LATIHAN</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Impor PDF</h1>
    <p className="mt-3 leading-7 text-slate-500">Unggah, periksa, lalu tinjau hasil ekstraksi. Kami tidak menebak isi atau jawaban yang tidak terbaca.</p>
    <section className="panel mt-8 p-5 sm:p-8" aria-label="Upload PDF"><UploadForm /></section>
    <section className="mt-10" aria-labelledby="template-title">
      <h2 id="template-title" className="text-xl font-semibold">Template PDF v1</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">Salin contoh ke dokumen satu kolom, lalu ekspor sebagai PDF teks. Jangan tambahkan tabel, gambar, header/footer, atau nomor halaman. Marker harus berada di awal baris. Satu PDF memuat satu kategori dan satu bank; tiap soal ditutup dengan ---END---.</p>
      <pre className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 text-xs leading-6" tabIndex={0}>{template}</pre>
      <h3 className="mt-6 font-semibold">Soal berbobot</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">Untuk pengetahuan umum atau topik di luar SKD, gunakan CATEGORY: RANDOM. Pilih SINGLE_CORRECT untuk satu kunci jawaban, atau WEIGHTED jika opsi memiliki bobot yang Anda tentukan.</p>
      <p className="mt-2 text-sm leading-7 text-slate-600">Untuk TKP, gunakan CATEGORY: TKP dan TYPE: WEIGHTED. Ganti KEY dengan bobot lengkap A–E berupa integer 0–5. Pembahasan opsional; hilangkan bagian EXPLANATION bila tidak tersedia.</p>
      <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-xs" tabIndex={0}>WEIGHTS: A=1;B=2;C=3;D=4;E=5</pre>
      <p className="mt-4 text-sm leading-7 text-slate-500">Teks pertanyaan dan opsi dapat berlanjut ke baris berikutnya atau halaman berikutnya. Jangan gunakan baris marker sebagai isi pertanyaan. Bobot adalah data latihan yang Anda isi, bukan penetapan skor resmi CPNS.</p>
    </section>
    <aside className="mt-8 rounded-xl bg-slate-100 p-5 text-sm leading-6 text-slate-600">PDF asli tidak disimpan. Draft preview berlaku 24 jam dan hanya dapat dibaca oleh akun Anda.</aside>
  </main><SiteFooter /></>;
}
