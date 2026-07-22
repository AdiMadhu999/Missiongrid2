import React, { useState, useEffect } from 'react';
import { getTestById } from '../../services/test-v2/testReader';
import { createAttempt, getActiveAttempt, updateAttemptResponse, submitAttempt } from '../../services/test-v2/attemptEngine';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { Question } from '../../models/question';
import QuestionPalette from '../../components/test-v2/QuestionPalette';
import { Capacitor } from '@capacitor/core';

export default function TestAttemptSession() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [test, setTest] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    async function initTest() {
      if (!testId || !currentUser) return;
      try {
        const testData = await getTestById(testId) as any;
        
        // Premium Validation Guard
        if (testData?.testType === 'premium' && !userProfile?.isPremium && userProfile?.role === "student") {
          alert("Premium Access Required: This test is restricted to premium students.");
          navigate('/app/tests');
          return;
        }

        const isStudent = userProfile?.role === "student";
        const isGuest = !userProfile;
        const isMentor = userProfile && !isStudent;

        if (!isMentor && !testData?.isPractice && !testData?.shareToCommunity && !testData?.isPublic) {
          if (isGuest) {
            alert("Security Alert: This test is not public. Please log in.");
            navigate('/app/tests');
            return;
          } else if (isStudent) {
            const studentBatchId = userProfile.batchId || "";
            const isAssigned = (testData?.batchIds && testData.batchIds.includes(studentBatchId)) || (testData?.batchId === studentBatchId);
            if (!isAssigned) {
              alert("Security Alert: This test is not assigned to your batch.");
              navigate('/app/tests');
              return;
            }
          }
        }

        setTest(testData);
        
        // Check for active attempt
        const userId = userProfile?.id || currentUser.uid;
        const existingAttempt = await getActiveAttempt(userId, testId) as any;
        if (existingAttempt) {
            setAttemptId(existingAttempt.id);
            setResponses(existingAttempt.responses || {});
        } else {
            const newAttemptId = await createAttempt(userId, testId);
            setAttemptId(newAttemptId);
        }
        
        setTimeLeft((testData as any).duration);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    initTest();
  }, [testId, currentUser]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
        setTimeLeft(prev => (prev! > 0 ? prev! - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleOptionSelect = async (questionId: string, optionIndex: number) => {
    if (!attemptId) return;
    const response = { selectedOption: optionIndex };
    setResponses(prev => ({ ...prev, [questionId]: response }));
    await updateAttemptResponse(attemptId, questionId, response);
  };

  const handleSubmit = async () => {
    if (!attemptId) return;
    await submitAttempt(attemptId, test);
    navigate(`/tests/result/${attemptId}`);
  };

  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          return;
        }
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          const fsPromise = document.documentElement.requestFullscreen();
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Fullscreen timeout")), 1500));
          await Promise.race([fsPromise, timeoutPromise]);
        }
      } catch (err) {
        // Fullscreen request is a progressive enhancement and might be blocked by iframe sandboxing or lack of user gesture
      }
    };

    // Attempt to enter fullscreen after the component has mounted and settled
    const timer = setTimeout(enterFullscreen, 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <div className="p-4 text-center">Loading Test...</div>;
  if (!test) return <div className="p-4 text-center">Test not found</div>;

  const questions: Question[] = test.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="p-6 max-w-5xl mx-auto flex gap-6">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{test.title}</h1>
          <div className="text-red-600 font-mono text-lg">
              Time Left: {Math.floor(timeLeft! / 60)}:{String(timeLeft! % 60).padStart(2, '0')}
          </div>
        </div>
        {currentQuestion ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-lg mb-4">{currentQuestion.text}</p>
            <div className="space-y-2">
              {currentQuestion.options?.map((option, index) => (
                <button
                  key={index}
                  className={`w-full text-left p-3 border rounded ${responses[currentQuestion.id]?.selectedOption === index ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'}`}
                  onClick={() => handleOptionSelect(currentQuestion.id, index)}
                >
                  {option.text}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button 
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              {currentQuestionIndex === questions.length - 1 ? (
                  <button 
                      onClick={handleSubmit}
                      className="px-4 py-2 bg-green-600 text-white rounded"
                  >
                      Submit
                  </button>
              ) : (
                  <button 
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                  >
                  Next
                  </button>
              )}
            </div>
          </div>
        ) : (
          <p>No questions found in this test.</p>
        )}
      </div>
      <div className="w-64">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-bold mb-4">Question Palette</h3>
          <QuestionPalette 
            questions={questions} 
            currentQuestionIndex={currentQuestionIndex} 
            onSelect={setCurrentQuestionIndex} 
            responses={responses} 
          />
        </div>
      </div>
    </div>
  );
}

