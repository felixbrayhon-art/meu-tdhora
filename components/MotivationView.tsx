import React, { useState, useEffect } from 'react';
import { getDailyBibleMotivation } from '../services/geminiService';

const MotivationView: React.FC = () => {
    const [motivation, setMotivation] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const lastFetch = localStorage.getItem('motivation_fetch_date');
        const today = new Date().toISOString().split('T')[0];

        if (lastFetch === today) {
            setMotivation(localStorage.getItem('motivation_content'));
        } else {
            fetchMotivation();
        }
    }, []);

    const fetchMotivation = async () => {
        setLoading(true);
        try {
            const content = await getDailyBibleMotivation();
            localStorage.setItem('motivation_fetch_date', new Date().toISOString().split('T')[0]);
            localStorage.setItem('motivation_content', content);
            setMotivation(content);
        } catch (error) {
            console.error("Failed to fetch motivation", error);
            setMotivation("Tudo posso naquele que me fortalece. - Reflexão: Confie no seu processo e mantenha a calma.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-emerald-50 rounded-[40px] p-10 border border-emerald-100 flex flex-col justify-center items-center shadow-sm relative overflow-hidden h-full animate-in zoom-in-95 duration-300 lg:col-span-3">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-6 leading-none text-emerald-900">MOMENTO DE <span className="text-emerald-500">PAZ</span></h2>
            {loading ? (
                <p className="text-emerald-800 text-lg font-bold text-center">Carregando inspiração...</p>
            ) : (
                <p className="text-emerald-800 text-lg font-bold text-center max-w-lg leading-relaxed">{motivation}</p>
            )}
        </div>
    );
};

export default MotivationView;
