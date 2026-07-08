import React from 'react';

interface PaletteProps {
  questions: any[];
  currentQuestionIndex: number;
  onSelect: (index: number) => void;
  responses: Record<string, any>;
}

export default function QuestionPalette({ questions, currentQuestionIndex, onSelect, responses }: PaletteProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {questions.map((q, index) => {
        const isAnswered = !!responses[q.id];
        const isCurrent = index === currentQuestionIndex;
        
        let className = "w-10 h-10 flex items-center justify-center rounded border ";
        if (isCurrent) className += "border-blue-500 bg-blue-100 ";
        else if (isAnswered) className += "bg-green-500 text-white ";
        else className += "bg-gray-100 ";
        
        return (
          <button key={q.id} className={className} onClick={() => onSelect(index)}>
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}
