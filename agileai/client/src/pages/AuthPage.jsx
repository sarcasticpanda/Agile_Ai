import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ArrowRight } from 'lucide-react';
import useAuthStore from '../store/authStore';
import axiosInstance from '../api/axiosInstance';

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated, login: storeLogin } = useAuthStore();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'developer',
  });

  useEffect(() => {
    if (isAuthenticated) {
      const userState = useAuthStore.getState().user;
      if (userState?.role === 'pm') {
        navigate('/pm/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await axiosInstance.post(endpoint, payload);
      const data = response.data;

      if (data.success && data.data) {
        if (!isLogin && data.data.status === 'pending') {
          // Block login for newly registered pending users
          setError('');
          import('react-hot-toast').then(({ toast }) => toast.success('Registration successful! Your account is pending admin approval.'));
          setIsLogin(true); // Switch back to login view
          setFormData({ ...formData, password: '' }); // Clear password
        } else {
          const { token, refreshToken, ...userData } = data.data;
          storeLogin(userData, token, refreshToken);
          if (userData.role === 'pm') {
            navigate('/pm/dashboard');
          } else {
            navigate('/dashboard');
          }
        }
      } else {
        setError(data.message || 'Something went wrong');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Network error';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center">
      <main className="w-full max-w-[1100px] min-h-[700px] flex overflow-hidden shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 m-4">
        
        {/* Left Side - Design */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 gradient-bg p-12 text-white relative">
          <div className="z-10">
            <div className="flex items-center gap-2 mb-12">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/30">
                <Bot size={24} className="text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">AgileAI</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-6">
              AI-powered sprint <br/>intelligence.
            </h1>
            <p className="text-lg text-indigo-100 max-w-sm font-light">
              AgileAI streamlines your product development by combining traditional agile methodologies with modern LLM workflows.
            </p>
          </div>
          <div className="z-10">
            <div className="flex flex-wrap gap-4 opacity-80">
              <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 text-sm">Real-time Diffs</div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 text-sm">AI Triage</div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 text-sm">Visual Planning</div>
            </div>
            <div className="mt-8 text-xs text-indigo-200">
              © 2024 AgileAI. Built for high-velocity teams.
            </div>
          </div>
          
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"></path>
                </pattern>
              </defs>
              <rect fill="url(#grid)" height="100%" width="100%"></rect>
            </svg>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 bg-white dark:bg-[#0A0A0B] flex flex-col items-center justify-center p-8 sm:p-12 md:p-16">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
              <div className="lg:hidden flex justify-center mb-6">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white">
                  <Bot size={28} />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                {isLogin ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                {isLogin ? 'Enter your credentials to access your sprints.' : 'Join the next generation of project management.'}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Full Name"
                    required={!isLogin}
                    className="block w-full px-4 py-3 text-slate-900 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-primary focus:border-primary dark:text-white outline-none"
                  />
                </div>
              )}

              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                  required
                  className="block w-full px-4 py-3 text-slate-900 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-primary focus:border-primary dark:text-white outline-none"
                />
              </div>

              <div className={!isLogin ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-4'}>
                <div className="relative">
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password"
                    required
                    minLength={6}
                    className="block w-full px-4 py-3 text-slate-900 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-primary focus:border-primary dark:text-white outline-none"
                  />
                </div>

                {!isLogin && (
                  <div className="space-y-1 sm:col-span-2">
                    <div className="relative">
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="block w-full px-4 py-3 text-slate-900 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-primary focus:border-primary appearance-none dark:text-white outline-none cursor-pointer"
                      >
                        <option value="developer">Developer</option>
                        <option value="pm">Project Manager (pending admin)</option>
                      </select>
                      <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
                        <ArrowRight size={18} className="rotate-90" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug px-0.5">
                      New accounts are <strong>Developer · Pending</strong>. An admin activates you and may grant{' '}
                      <strong>PM</strong> if you requested it.
                    </p>
                  </div>
                )}
              </div>

              {isLogin && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input className="w-4 h-4 rounded border-slate-300 dark:border-zinc-700 text-primary focus:ring-primary bg-transparent" type="checkbox"/>
                    <span className="ml-2">Remember me</span>
                  </label>
                  <a className="text-primary hover:underline font-medium" href="#">Forgot password?</a>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-primary hover:opacity-90 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    {isLogin ? 'Login to AgileAI' : 'Create Workspace'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-zinc-800"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-[#0A0A0B] px-2 text-slate-500 uppercase tracking-wider font-semibold">Or continue with</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                <img alt="Google" className="w-4 h-4" src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"/>
                <span className="text-sm font-medium">Google</span>
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                <Bot size={18} className="dark:invert" />
                <span className="text-sm font-medium">GitHub</span>
              </button>
            </div>

            <p className="text-center text-slate-600 dark:text-slate-400 text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"} 
              <button 
                className="text-primary font-semibold hover:underline ml-1" 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setFormData({ name: '', email: '', password: '', role: 'developer' });
                }}
              >
                {isLogin ? 'Register now' : 'Login instead'}
              </button>
            </p>

            <div className="mt-12 flex items-center justify-center gap-6 text-xs text-slate-400">
              <a className="hover:text-primary transition-colors" href="#">Help Center</a>
              <a className="hover:text-primary transition-colors" href="#">Privacy</a>
              <a className="hover:text-primary transition-colors" href="#">System Status</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
