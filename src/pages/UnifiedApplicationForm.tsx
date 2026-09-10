import { useParams } from "react-router-dom";
import DynamicApplication from "./DynamicApplication";

// Use the canonical applicant/profile/requirements APIs; reset all in-memory
// drafts when switching applications, including browser back/forward navigation.
export default function UnifiedApplicationForm() {
  const { referenceNumber } = useParams();
  return <DynamicApplication key={referenceNumber} />;
}
