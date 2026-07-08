const fs = require('fs');
let code = fs.readFileSync('src/components/MentorLoginForm.tsx', 'utf8');

const target = `
  const handleInitialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await AuthService.loginWithMobileAndPassword(mobile, '', 'mentor', 'pin');
      
      if (user.mentorDirectLogin) {
          onSuccess(user);
          return;
      }
      setTempUserSession(user);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Mentor authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityPin || securityPin.length < 4) {
      setError("Please enter valid security PIN");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const finalUser = await AuthService.verifyMentorSecurityPin(mobile, securityPin, tempUserSession);
      onSuccess(finalUser);
    } catch (err: any) {
      setError(err.message || 'Security PIN verification failed.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <form className="space-y-4" onSubmit={handleInitialLogin}>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-50/90 text-rose-600 text-[10px] font-bold p-3 rounded-xl border border-rose-100 shadow-sm flex items-start gap-2"
          >
            <span className="mt-0.5"><ShieldAlert size={14} /></span>
            <span>{error}</span>
          </motion.div>
        )}

        <div>
          <label htmlFor="mentor-mobile" className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-1">
            Mentor ID (Mobile)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">
              +91
            </span>
            <input
              id="mentor-mobile"
              type="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\\D/g, ''))}
              className="block w-full rounded-xl border-indigo-200 bg-white py-2.5 pl-10 pr-3 text-slate-900 font-medium text-sm border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="10-digit number"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-xs font-black text-white shadow-lg hover:bg-indigo-700 active:translate-y-0 hover:-translate-y-0.5 transition-all disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? 'Verifying...' : 'Next Step'} <ArrowRight size={16} />
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleVerifyPin}>
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50/90 text-rose-600 text-[10px] font-bold p-3 rounded-xl border border-rose-100 shadow-sm flex items-start gap-2"
        >
          <span className="mt-0.5"><ShieldAlert size={14} /></span>
          <span>{error}</span>
        </motion.div>
      )}

      <div>
        <label htmlFor="mentor-pin" className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-1">
          Security PIN
        </label>
        <div className="relative">
            <input
              id="mentor-pin"
              type={showPin ? "text" : "password"}
              required
              value={securityPin}
              onChange={(e) => setSecurityPin(e.target.value)}
              className="block w-full rounded-xl border-indigo-200 bg-white py-2.5 px-3 pr-10 text-slate-900 font-medium text-sm border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 tracking-widest"
              placeholder="••••••"
            />
            <button 
              type="button" 
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
        <p className="text-[9px] text-slate-500 mt-1">Enter your 6-digit mentor access PIN.</p>
      </div>

      <div className="pt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="py-3 px-4 rounded-xl bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-xs font-black text-white shadow-lg hover:bg-indigo-700 active:translate-y-0 hover:-translate-y-0.5 transition-all disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2"
        >
          {loading ? 'Unlocking...' : 'Authenticate'}
        </button>
      </div>
    </form>
  );
`;

const replacement = `
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!securityPin || securityPin.length !== 6) {
      setError("Security PIN must be exactly 6 digits.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await AuthService.loginWithMobileAndPassword(mobile, securityPin, 'mentor', 'pin');
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Mentor authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleLogin}>
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50/90 text-rose-600 text-[10px] font-bold p-3 rounded-xl border border-rose-100 shadow-sm flex items-start gap-2"
        >
          <span className="mt-0.5"><ShieldAlert size={14} /></span>
          <span>{error}</span>
        </motion.div>
      )}

      <div>
        <label htmlFor="mentor-mobile" className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-1">
          Mentor ID (Mobile)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">
            +91
          </span>
          <input
            id="mentor-mobile"
            type="tel"
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\\D/g, ''))}
            className="block w-full rounded-xl border-indigo-200 bg-white py-2.5 pl-10 pr-3 text-slate-900 font-medium text-sm border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="10-digit number"
          />
        </div>
      </div>

      <div>
        <label htmlFor="mentor-pin" className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-1">
          6-Digit Security PIN
        </label>
        <div className="relative">
            <input
              id="mentor-pin"
              type={showPin ? "text" : "password"}
              required
              value={securityPin}
              onChange={(e) => setSecurityPin(e.target.value)}
              maxLength={6}
              pattern="\\d{6}"
              inputMode="numeric"
              className="block w-full rounded-xl border-indigo-200 bg-white py-2.5 px-3 pr-10 text-slate-900 font-medium text-sm border shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 tracking-widest"
              placeholder="••••••"
            />
            <button 
              type="button" 
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-xs font-black text-white shadow-lg hover:bg-indigo-700 active:translate-y-0 hover:-translate-y-0.5 transition-all disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2"
        >
          {loading ? 'Unlocking...' : 'Authenticate'} <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
`;

code = code.replace(target.trim(), replacement.trim());
fs.writeFileSync('src/components/MentorLoginForm.tsx', code);
console.log("Patched MentorLoginForm");
