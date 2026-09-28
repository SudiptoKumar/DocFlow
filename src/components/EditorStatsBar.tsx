import { useState, useEffect, useRef } from 'react';
import { Type, FileText, MessageSquare, AlignLeft, Target } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface EditorStatsBarProps {
  text: string;
}

const EditorStatsBar = ({ text }: EditorStatsBarProps) => {
  const [stats, setStats] = useState([
    { icon: Type, label: 'W', value: 0, color: 'text-emerald-500' },
    { icon: FileText, label: 'C', value: 0, color: 'text-blue-500' },
    { icon: MessageSquare, label: 'S', value: 0, color: 'text-amber-500' },
    { icon: AlignLeft, label: 'P', value: 0, color: 'text-purple-500' },
  ]);
  const [wordGoal, setWordGoal] = useState<number | null>(() => {
    const saved = localStorage.getItem('docflow-word-goal');
    return saved ? parseInt(saved, 10) : null;
  });
  const [goalInput, setGoalInput] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      const charCount = text.length;
      const sentenceCount = text.trim() ? (text.match(/[.!?।]+(?:\s|$)/g) || []).length : 0;
      const paragraphCount = text.trim() ? text.split(/\n\s*\n/).filter(p => p.trim()).length : 0;

      setStats([
        { icon: Type, label: 'W', value: wordCount, color: 'text-emerald-500' },
        { icon: FileText, label: 'C', value: charCount, color: 'text-blue-500' },
        { icon: MessageSquare, label: 'S', value: sentenceCount, color: 'text-amber-500' },
        { icon: AlignLeft, label: 'P', value: paragraphCount, color: 'text-purple-500' },
      ]);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [text]);

  const handleSetGoal = () => {
    const val = parseInt(goalInput, 10);
    if (val > 0) {
      setWordGoal(val);
      localStorage.setItem('docflow-word-goal', val.toString());
    } else {
      setWordGoal(null);
      localStorage.removeItem('docflow-word-goal');
    }
  };

  const handleClearGoal = () => {
    setWordGoal(null);
    setGoalInput('');
    localStorage.removeItem('docflow-word-goal');
  };

  const wordCount = stats[0].value;
  const goalProgress = wordGoal ? Math.min((wordCount / wordGoal) * 100, 100) : 0;

  return (
    <div className="editor-stats-bar flex items-center justify-center gap-3 px-3 py-1.5 bg-gray-50/80 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 text-[11px] font-mono">
      {stats.map((stat, i) => (
        <span key={stat.label} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-300 dark:text-gray-600 mr-3">|</span>}
          {i === 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity">
                  <stat.icon className={`w-3 h-3 ${stat.color}`} />
                  <span className={`font-semibold ${stat.color}`}>{stat.label}</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {wordGoal ? `${stat.value.toLocaleString()} / ${wordGoal.toLocaleString()}` : stat.value.toLocaleString()}
                  </span>
                  {wordGoal && <Target className="w-3 h-3 text-emerald-400 ml-0.5" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" side="top">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Word Count Goal</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="h-8 text-xs"
                      min={1}
                    />
                    <Button size="sm" onClick={handleSetGoal} className="h-8 text-xs px-3">Set</Button>
                  </div>
                  {wordGoal && (
                    <button onClick={handleClearGoal} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                      Clear goal
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <>
              <stat.icon className={`w-3 h-3 ${stat.color}`} />
              <span className={`font-semibold ${stat.color}`}>{stat.label}</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{stat.value.toLocaleString()}</span>
            </>
          )}
        </span>
      ))}
      {wordGoal && (
        <>
          <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
          <Progress value={goalProgress} className="w-16 h-1.5" />
          <span className={`text-[10px] font-medium ${goalProgress >= 100 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {Math.round(goalProgress)}%
          </span>
        </>
      )}
    </div>
  );
};

export default EditorStatsBar;
