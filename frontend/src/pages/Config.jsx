import { useState, useEffect } from 'react';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { Save, FileEdit, Settings, Database } from 'lucide-react';
import { toast } from 'sonner';

export default function Config() {
    const { currentBrand } = useBrand();
    const [prompts, setPrompts] = useState([]);
    const [selectedPrompt, setSelectedPrompt] = useState(null);
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (currentBrand) {
            loadPrompts();
        }
    }, [currentBrand]);

    const loadPrompts = async () => {
        try {
            const { data: { session } } = await import('../supabase').then(m => m.supabase.auth.getSession());
            const authToken = session?.access_token;

            const res = await fetch(`/api/prompts/?brand_id=${currentBrand.id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            setPrompts(data.prompts || []);

            if (data.prompts?.length > 0 && !selectedPrompt) {
                selectPrompt(data.prompts[0]);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const selectPrompt = (prompt) => {
        setSelectedPrompt(prompt);
        setContent(prompt.content);
    };

    const handleSave = async () => {
        if (!selectedPrompt) return;
        setSaving(true);
        const toastId = toast.loading("Saving prompt...");

        try {
            const { data: { session } } = await import('../supabase').then(m => m.supabase.auth.getSession());
            const authToken = session?.access_token;

            const res = await fetch('/api/prompts/update', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    brand_id: currentBrand.id,
                    name: selectedPrompt.name,
                    content: content
                })
            });

            if (res.ok) {
                toast.success("Prompt updated!", { id: toastId });
                // Update local state
                setPrompts(prompts.map(p => p.name === selectedPrompt.name ? { ...p, content } : p));
            } else {
                throw new Error("Failed to save");
            }
        } catch (e) {
            toast.error("Error saving prompt", { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Settings size={32} className="text-primary" />
                        Configuration
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage AI prompts and brand settings</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn bg-primary text-primary-foreground px-6 py-2 rounded-lg shadow-lg hover:shadow-xl hover:bg-primary/90 flex items-center gap-2 transition-all"
                >
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
                {/* Sidebar List */}
                <div className="col-span-3 glass rounded-xl overflow-hidden flex flex-col">
                    <div className="p-4 bg-gray-50/50 border-b font-semibold text-gray-500 uppercase text-xs tracking-wider">
                        Prompts
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {prompts.map(p => (
                            <button
                                key={p.name}
                                onClick={() => selectPrompt(p)}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
                                    ${selectedPrompt?.name === p.name ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50'}
                                `}
                            >
                                <FileEdit size={16} className={selectedPrompt?.name === p.name ? 'text-primary' : 'text-gray-400'} />
                                {p.name.replace('.txt', '').replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="col-span-9 glass rounded-xl overflow-hidden flex flex-col">
                    <div className="p-4 bg-gray-50/50 border-b flex justify-between items-center">
                        <span className="font-mono text-sm text-gray-500">{selectedPrompt?.name}</span>
                        <div className="text-xs text-gray-400">MarkDown & Handlebars supported</div>
                    </div>
                    <div className="flex-1 relative">
                        <textarea
                            className="w-full h-full p-6 resize-none bg-transparent outline-none font-mono text-sm leading-relaxed text-gray-800"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            spellCheck="false"
                        ></textarea>
                    </div>
                </div>
            </div>
        </div>
    );
}
