# SkillTwin scoring guardrails (a2): rapid safety improvement

## Scope and status

This patch improves **newly completed** assessment scoring without training a new model, adding network services, or modifying existing learner records. It preserves the existing skill estimator (`skill-estimator-a1`) and role-gap engine; the assessment aggregator is independently versioned as `assessment-aggregator-e2`.

**Important:** a2 is a conservative, transparent heuristic, *not* an empirical calibration, probabilistic confidence, Item Response Theory, or a claim of validated hiring readiness. Expert annotation and evaluation remain future work.

## Original issue

Previous assessment completion computed `levelSignal = 0.4 + 2.5 * normalizedScore` irrespective of observed question difficulty. Four correct easy questions yielded a 2.9/4 level signal, mapping to `ADVANCED` for an isolated assessment. Previous assessment confidence at complete coverage with four items reached `0.58+0.22+0.15*(4/6)=0.90` despite just four observations.

## New a2 design

- Keep the existing difficulty-weighted **accuracy** score for continuity: `sum(score_i * (0.8+0.1*difficulty_i)) / sum(0.8+0.1*difficulty_i)`.
- Separately derive evidence capability from **demonstrated** difficulty, not just percent correct:
  `levelSignal = clamp(0.35 + 0.65 * sum(score_i * difficulty_i * weight_i) / sum(weight_i), 0, 3.2)`.
- Thus four perfect difficulty-1 answers yield `1.00` (BEGINNER); four difficulty-2 yield `1.65` (INTERMEDIATE); four difficulty-3 yield `2.30` (INTERMEDIATE); four difficulty-4 yield `2.95` (ADVANCED). Short assessment completions cannot directly confer EXPERT. Incorrect harder items cannot increase capability.
- Replace assessment-confidence arithmetic with a bounded indicator combining concept coverage, answer count, evaluator reliability and distinct covered concepts. Four perfect MCQs covering four concepts produce about `0.69` versus `0.90` previously.
- The model's `evaluator_confidence` is now used in final assessment confidence. Invalid or non-finite scores, difficulties and evaluator values are rejected.
- Retain the existing Evidence Engine's source deduplication, transactionality, and downstream gap/replan trigger. Store scoring version and observed difficulty/evaluator metadata on each new assessment evidence item.

## Release boundaries

- No migrations and no automatic reprocessing of historical assessments; historical assessments retain their original scoring model.
- Do not silently replace the entire skill estimator, conflict handling or career readiness formula with unvalidated weights.
- The guardrail tests demonstrate invariants, **not external validity**.
- Check build, deterministic tests and a signed-in staging assessment from start to finish before deploying.
- Treat `confidence` and `readiness` as heuristic *indicators* in UI/pitches, never statistically calibrated probabilities.

## Benchmark invariants implemented

1. At equal accuracy and same number of items, higher demonstrated question difficulty gives a stronger proficiency signal.
2. Adding a failed difficult question cannot make a learner more proficient.
3. A perfect short easy assessment cannot imply ADVANCED or EXPERT.
4. Lower evaluator trust or narrower coverage cannot increase assessment confidence.
5. Invalid evidence inputs are rejected rather than silently counted.
6. Normalized assessment percentage preserves its legacy difficulty weighting.
7. An isolated perfect easy quiz updates the Evidence Engine to BEGINNER, not ADVANCED.

## Planned validation after submission

Collect expert-labeled work across difficulty levels, assessment item response histories, independent test-set performance and calibration error; compare a1 and a2 against those labels before calling the system validated or rerunning old assessments.
