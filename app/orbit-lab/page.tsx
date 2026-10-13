import type { Metadata } from "next";
import OrbitLab from "./orbit-lab";
import "./orbit-lab.css";

export const metadata: Metadata = {
  title: "SkillTwin Orbit — Design exploration",
  description: "Interactive design prototypes for SkillTwin's next-generation learner experience."
};

export default function OrbitLabPage() {
  return <OrbitLab />;
}
