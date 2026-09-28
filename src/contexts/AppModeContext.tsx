import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type AppMode = 'docflow' | 'duoflow';
export type PreviewMode = 'interwoven' | 'side-by-side';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  // DocFlow state persistence
  docflowContent: string;
  setDocflowContent: (content: string) => void;
  // DuoFlow state persistence
  duoflowSourceContent: string;
  duoflowTargetContent: string;
  duoflowMixedContent: string;
  duoflowPreviewMode: PreviewMode;
  setDuoflowSourceContent: (content: string) => void;
  setDuoflowTargetContent: (content: string) => void;
  setDuoflowMixedContent: (content: string) => void;
  setDuoflowPreviewMode: (mode: PreviewMode) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

interface AppModeProviderProps {
  children: ReactNode;
}

export const AppModeProvider: React.FC<AppModeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<AppMode>('docflow');
  
  // DocFlow state
  const [docflowContent, setDocflowContent] = useState('');
  
  // DuoFlow state
  const [duoflowSourceContent, setDuoflowSourceContent] = useState('');
  const [duoflowTargetContent, setDuoflowTargetContent] = useState('');
  const [duoflowMixedContent, setDuoflowMixedContent] = useState('');
  const [duoflowPreviewMode, setDuoflowPreviewMode] = useState<PreviewMode>('interwoven');

  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'docflow' ? 'duoflow' : 'docflow');
  }, []);

  return (
    <AppModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        docflowContent,
        setDocflowContent,
        duoflowSourceContent,
        duoflowTargetContent,
        duoflowMixedContent,
        duoflowPreviewMode,
        setDuoflowSourceContent,
        setDuoflowTargetContent,
        setDuoflowMixedContent,
        setDuoflowPreviewMode,
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
};

export const useAppMode = (): AppModeContextType => {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
};
