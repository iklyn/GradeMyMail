import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Email content state interface
interface EmailContent {
  id: string;
  originalText: string;
  originalHTML: string;
  taggedContent?: string;
  analyzedSentences?: Array<{
    type: 'fluff' | 'spam_words' | 'hard_to_read';
    sentence: string;
    position: { start: number; end: number };
    severity: 'low' | 'medium' | 'high';
  }>;
  metadata?: {
    emailType?: 'business' | 'marketing' | 'personal' | 'follow-up';
    tone?: 'professional' | 'casual' | 'urgent' | 'friendly';
    readabilityScore?: number;
    engagementScore?: number;
    wordCount?: number;
    estimatedReadTime?: number;
    createdAt?: Date;
    lastModified?: Date;
    version?: number;
  };
}

// UI state interface
interface UIState {
  isAnalyzing: boolean;
  isFixing: boolean;
  currentStep: 'grade' | 'fix';
  showLegend: boolean;
  theme: 'light' | 'dark';
}

// Error state interface
interface ErrorState {
  hasError: boolean;
  errorMessage?: string;
  errorType?: 'network' | 'validation' | 'ai' | 'client' | 'server';
  lastError?: Error;
}

// Combined store interface
interface AppStore {
  // Email content state
  emailContent: EmailContent | null;
  
  // UI state
  ui: UIState;
  
  // Error state
  error: ErrorState;
  
  // Actions for email content
  setEmailContent: (content: Partial<EmailContent>) => void;
  updateEmailContent: (updates: Partial<EmailContent>) => void;
  clearEmailContent: () => void;
  
  // Actions for UI state
  setAnalyzing: (isAnalyzing: boolean) => void;
  setFixing: (isFixing: boolean) => void;
  setCurrentStep: (step: 'grade' | 'fix') => void;
  toggleLegend: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Actions for error handling
  setError: (error: Partial<ErrorState>) => void;
  clearError: () => void;
  
  // Utility actions
  reset: () => void;
}

// Initial states
const initialEmailContent: EmailContent | null = null;

const initialUIState: UIState = {
  isAnalyzing: false,
  isFixing: false,
  currentStep: 'grade',
  showLegend: false,
  theme: 'light',
};

const initialErrorState: ErrorState = {
  hasError: false,
  errorMessage: undefined,
  errorType: undefined,
  lastError: undefined,
};

// Create the store
export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      // Initial state
      emailContent: initialEmailContent,
      ui: initialUIState,
      error: initialErrorState,
      
      // Email content actions
      setEmailContent: (content) =>
        set(
          () => ({
            emailContent: {
              id: content.id || crypto.randomUUID(),
              originalText: content.originalText || '',
              originalHTML: content.originalHTML || '',
              ...content,
            },
          }),
          false,
          'setEmailContent'
        ),
      
      updateEmailContent: (updates) =>
        set(
          (state) => ({
            emailContent: state.emailContent
              ? { ...state.emailContent, ...updates }
              : null,
          }),
          false,
          'updateEmailContent'
        ),
      
      clearEmailContent: () =>
        set({ emailContent: null }, false, 'clearEmailContent'),
      
      // UI actions
      setAnalyzing: (isAnalyzing) =>
        set(
          (state) => ({
            ui: { ...state.ui, isAnalyzing },
          }),
          false,
          'setAnalyzing'
        ),
      
      setFixing: (isFixing) =>
        set(
          (state) => ({
            ui: { ...state.ui, isFixing },
          }),
          false,
          'setFixing'
        ),
      
      setCurrentStep: (currentStep) =>
        set(
          (state) => ({
            ui: { ...state.ui, currentStep },
          }),
          false,
          'setCurrentStep'
        ),
      
      toggleLegend: () =>
        set(
          (state) => ({
            ui: { ...state.ui, showLegend: !state.ui.showLegend },
          }),
          false,
          'toggleLegend'
        ),
      
      setTheme: (theme) =>
        set(
          (state) => ({
            ui: { ...state.ui, theme },
          }),
          false,
          'setTheme'
        ),
      
      // Error actions
      setError: (error) =>
        set(
          (state) => ({
            error: { ...state.error, hasError: true, ...error },
          }),
          false,
          'setError'
        ),
      
      clearError: () =>
        set({ error: initialErrorState }, false, 'clearError'),
      
      // Utility actions
      reset: () =>
        set(
          {
            emailContent: initialEmailContent,
            ui: initialUIState,
            error: initialErrorState,
          },
          false,
          'reset'
        ),
    }),
    {
      name: 'email-analysis-store',
    }
  )
);

// Selector hooks for better performance
export const useEmailContent = () => useAppStore((state) => state.emailContent);
export const useUIState = () => useAppStore((state) => state.ui);
export const useErrorState = () => useAppStore((state) => state.error);
export const useIsAnalyzing = () => useAppStore((state) => state.ui.isAnalyzing);
export const useIsFixing = () => useAppStore((state) => state.ui.isFixing);
export const useCurrentStep = () => useAppStore((state) => state.ui.currentStep);