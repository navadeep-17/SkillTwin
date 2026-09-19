import "server-only";
import { getSql } from "@/lib/db/postgres";
import type { CanonicalSkillEntry, CandidateSkillClaim } from "@/lib/profile/skill-mapper";
import type { ProfileSourceBlock } from "@/lib/profile/segmenter";
import type { ParsedPdf } from "@/lib/profile/pdf-parser";

export interface ProfileDocumentRecord {
  id: string;
  userId: string;
  version: number;
  fileName: string;
  storagePath: string;
  sha256: string;
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return value as Record<string, unknown>[];
}

export class PostgresProfileAnalysisRepository {
  async getDocument(userId: string, documentId: string): Promise<ProfileDocumentRecord | null> {
    const sql = getSql();
    const rows = rowsOf(await sql.unsafe(
      "select id,user_id,version,file_name,storage_path,sha256 from public.profile_documents where id=$1::uuid and user_id=$2::uuid and document_type='resume' limit 1",
      [documentId, userId]
    ));
    const row = rows[0];
    return row ? {
      id: String(row.id),
      userId: String(row.user_id),
      version: Number(row.version),
      fileName: String(row.file_name),
      storagePath: String(row.storage_path),
      sha256: String(row.sha256)
    } : null;
  }

  async getOrCreateRun(userId: string, document: ProfileDocumentRecord, schemaVersion: string) {
    const sql = getSql();
    const analysisKey = "resume:" + document.id + ":v" + document.version + ":" + schemaVersion;
    const rows = rowsOf(await sql.unsafe(
      "insert into public.profile_analysis_runs(user_id,source_type,source_id,source_version,analyzer_schema_version,analysis_key,status,stage,progress_percent) values ($1::uuid,'resume',$2::uuid,$3,$4,$5,'pending','queued',0) on conflict(user_id,analysis_key) do update set analysis_key=excluded.analysis_key returning *",
      [userId, document.id, document.version, schemaVersion, analysisKey]
    ));
    return rows[0];
  }

  async startRun(userId: string, runId: string) {
    const sql = getSql();
    await sql.unsafe(
      "update public.profile_analysis_runs set status='running',stage='parsing',progress_percent=5,started_at=coalesce(started_at,now()),error_code=null,error_message=null where id=$1::uuid and user_id=$2::uuid",
      [runId, userId]
    );
    await sql.unsafe(
      "update public.profile_documents set analysis_status='running' where id=(select source_id from public.profile_analysis_runs where id=$1::uuid)",
      [runId]
    );
  }

  async saveParse(userId: string, document: ProfileDocumentRecord, parsed: ParsedPdf) {
    const sql = getSql();
    await sql.begin(async tx => {
      await tx.unsafe(
        "insert into public.document_parse_runs(user_id,document_id,document_version,parser_version,status,full_text,page_map,quality,completed_at) values ($1::uuid,$2::uuid,$3,'pdfjs-b1','complete',$4,$5::jsonb,$6::jsonb,now()) on conflict(document_id,document_version,parser_version) do update set status='complete',full_text=excluded.full_text,page_map=excluded.page_map,quality=excluded.quality,error_code=null,error_message=null,completed_at=now()",
        [
          userId,
          document.id,
          document.version,
          parsed.fullText,
          JSON.stringify(parsed.pages.map(page => ({ page: page.page, charCount: page.charCount }))),
          JSON.stringify(parsed.quality)
        ]
      );
      await tx.unsafe(
        "update public.profile_documents set parse_status='parsed' where id=$1::uuid and user_id=$2::uuid",
        [document.id, userId]
      );
    });
  }

  async replaceBlocksAndClaims(input: {
    userId: string;
    runId: string;
    sourceId: string;
    blocks: ProfileSourceBlock[];
    claims: CandidateSkillClaim[];
  }) {
    const sql = getSql();
    await sql.begin(async tx => {
      await tx.unsafe(
        "delete from public.candidate_skill_claims where analysis_run_id=$1::uuid and user_id=$2::uuid",
        [input.runId, input.userId]
      );
      await tx.unsafe(
        "delete from public.profile_source_blocks where analysis_run_id=$1::uuid and user_id=$2::uuid",
        [input.runId, input.userId]
      );

      for (const block of input.blocks) {
        await tx.unsafe(
          "insert into public.profile_source_blocks(id,user_id,analysis_run_id,source_id,kind,title,text_content,page_start,page_end,ordinal) values ($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10)",
          [
            block.id,
            input.userId,
            input.runId,
            input.sourceId,
            block.kind,
            block.title,
            block.text,
            block.pageStart,
            block.pageEnd,
            block.ordinal
          ]
        );
      }

      for (const claim of input.claims) {
        await tx.unsafe(
          "insert into public.candidate_skill_claims(user_id,analysis_run_id,source_block_id,raw_skill_name,canonical_skill_id,claim_type,evidence_snippet,extraction_confidence,mapping_method,mapping_confidence) values ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6,$7,$8,$9,$10)",
          [
            input.userId,
            input.runId,
            claim.sourceBlockId,
            claim.rawSkillName,
            claim.canonicalSkillId,
            claim.claimType,
            claim.evidenceSnippet,
            claim.extractionConfidence,
            claim.mappingMethod,
            claim.mappingConfidence
          ]
        );
      }
    });
  }

  async listCatalog(): Promise<CanonicalSkillEntry[]> {
    const sql = getSql();
    const rows = rowsOf(await sql.unsafe(
      "select s.id,s.slug,s.canonical_name,coalesce(jsonb_agg(sa.alias) filter(where sa.id is not null),'[]'::jsonb) aliases from public.skills s left join public.skill_aliases sa on sa.skill_id=s.id where s.is_active=true group by s.id,s.slug,s.canonical_name order by s.canonical_name"
    ));
    return rows.map(row => ({
      id: String(row.id),
      slug: String(row.slug),
      canonicalName: String(row.canonical_name),
      aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : []
    }));
  }

  async setStage(
    userId: string,
    runId: string,
    stage: string,
    progress: number,
    counts?: Record<string, unknown>,
    warnings?: string[]
  ) {
    const sql = getSql();
    await sql.unsafe(
      "update public.profile_analysis_runs set stage=$1,progress_percent=$2,counts=coalesce($3::jsonb,counts),warnings=coalesce($4::jsonb,warnings) where id=$5::uuid and user_id=$6::uuid",
      [
        stage,
        progress,
        counts ? JSON.stringify(counts) : null,
        warnings ? JSON.stringify(warnings) : null,
        runId,
        userId
      ]
    );
  }

  async complete(
    userId: string,
    runId: string,
    documentId: string,
    result: unknown,
    counts: Record<string, unknown>,
    warnings: string[]
  ) {
    const sql = getSql();
    await sql.begin(async tx => {
      await tx.unsafe(
        "update public.profile_analysis_runs set status='complete',stage='complete',progress_percent=100,counts=$1::jsonb,warnings=$2::jsonb,evidence_batch_result=$3::jsonb,completed_at=now() where id=$4::uuid and user_id=$5::uuid",
        [JSON.stringify(counts), JSON.stringify(warnings), JSON.stringify(result), runId, userId]
      );
      await tx.unsafe(
        "update public.profile_documents set analysis_status='complete' where id=$1::uuid and user_id=$2::uuid",
        [documentId, userId]
      );
    });
  }

  async fail(userId: string, runId: string, documentId: string, code: string, message: string) {
    const sql = getSql();
    await sql.begin(async tx => {
      await tx.unsafe(
        "update public.profile_analysis_runs set status='failed',stage='failed',error_code=$1,error_message=$2,completed_at=now() where id=$3::uuid and user_id=$4::uuid",
        [code, message.slice(0, 1200), runId, userId]
      );
      await tx.unsafe(
        "update public.profile_documents set analysis_status='failed' where id=$1::uuid and user_id=$2::uuid",
        [documentId, userId]
      );
    });
  }
}
