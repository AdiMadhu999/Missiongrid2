export function parseSquashedExplanation(q: any) {
  let explanation = typeof q.explanation === 'string' ? q.explanation : '';
  let stepwiseSolution = q.stepwiseSolution || [];
  let examApproach = q.examApproach || '';
  let ruleOrTheorem = q.ruleOrTheorem || '';

  if (explanation && (!examApproach || !ruleOrTheorem)) {
    let detailedExp = explanation;
    
    const ruleMatch = detailedExp.match(/(?:Rule\s*\/?\s*Theorem|Rule|Theorem)\s*:\s*(.*)/is);
    if (ruleMatch && !ruleOrTheorem) {
      ruleOrTheorem = ruleMatch[1].trim();
      detailedExp = detailedExp.substring(0, ruleMatch.index).trim();
    }
    
    const approachMatch = detailedExp.match(/(?:Shortcut\s*Exam\s*Approach|Exam\s*Approach|Shortcut|Trick)\s*:\s*(.*)/is);
    if (approachMatch && !examApproach) {
      examApproach = approachMatch[1].trim();
      detailedExp = detailedExp.substring(0, approachMatch.index).trim();
    }
    
    const detailedMatch = detailedExp.match(/(?:Detailed\s*Explanation|Explanation|Solution)\s*:\s*(.*)/is);
    if (detailedMatch && detailedMatch.index === 0) {
       detailedExp = detailedMatch[1].trim();
    }
    
    explanation = detailedExp;
    if (!stepwiseSolution || stepwiseSolution.length === 0 || (stepwiseSolution.length === 1 && stepwiseSolution[0] === q.explanation)) {
      // Smart split logic to separate squashed paragraphs into distinct steps
      if (detailedExp.includes('\n') && detailedExp.split('\n').filter(Boolean).length > 1) {
        stepwiseSolution = detailedExp.split("\n").map(s => s.trim()).filter(Boolean);
      } else if (detailedExp.includes('।')) {
        stepwiseSolution = detailedExp.split(/।\s*/).filter(Boolean).map(s => s.trim() + '।');
      } else {
        // Fallback for English: split by dot followed by space and uppercase letter
        stepwiseSolution = detailedExp.split(/\.\s+(?=[A-Z])/).filter(Boolean).map((s, i, arr) => i === arr.length - 1 ? s : s.trim() + '.');
      }
    }
  }

  return {
    explanation,
    stepwiseSolution,
    examApproach,
    ruleOrTheorem
  };
}
