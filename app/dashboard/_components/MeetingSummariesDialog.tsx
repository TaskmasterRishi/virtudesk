"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { getMeetingSummaries } from '@/app/actions/Summary';
import { useOrganization } from '@clerk/nextjs';

type MeetingSummary = {
    id: string;
    room_id: string;
    org_id: string;
    summary_text: string;
    key_points: string[];
    participants: string[];
    duration_ms: number;
    start_time: string;
    end_time: string;
    created_at: string;
    transcriptions?: any[];
};

export default function MeetingSummariesDialog() {
    const [summaries, setSummaries] = useState<MeetingSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { organization } = useOrganization();

    const fetchSummaries = async () => {
        if (!organization?.id) return;
        
        setIsLoading(true);
        try {
            const data = await getMeetingSummaries(organization.id);
            setSummaries(data);
        } catch (error) {
            console.error("Error fetching summaries:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && organization?.id) {
            fetchSummaries();
        }
    }, [isOpen, organization?.id]);

    const formatDuration = (ms: number): string => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    };

    const formatDateTime = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                >
                    <FileText className="w-4 h-4" />
                    Show Summaries
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="w-6 h-6" />
                        Meeting Summaries
                    </DialogTitle>
                </DialogHeader>
                
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-muted-foreground">Loading summaries...</div>
                    </div>
                ) : summaries.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-center text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No meeting summaries available yet.</p>
                            <p className="text-sm mt-1">Summaries will appear here after meetings end.</p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-4">
                            {summaries.map((summary) => (
                                <Card key={summary.id} className="hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <CardTitle className="text-lg mb-2">
                                                    Meeting Summary
                                                </CardTitle>
                                                <CardDescription className="flex flex-wrap items-center gap-3 text-sm">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {formatDateTime(summary.start_time)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-4 h-4" />
                                                        {formatDuration(summary.duration_ms)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-4 h-4" />
                                                        {summary.participants.length} participant{summary.participants.length !== 1 ? 's' : ''}
                                                    </span>
                                                </CardDescription>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleExpand(summary.id)}
                                                className="h-8 w-8 p-0"
                                            >
                                                {expandedId === summary.id ? (
                                                    <ChevronUp className="w-4 h-4" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Summary</h4>
                                                <p className="text-sm leading-relaxed">{summary.summary_text}</p>
                                            </div>

                                            {summary.key_points && summary.key_points.length > 0 && (
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Key Points</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {summary.key_points.map((point, idx) => (
                                                            <Badge key={idx} variant="secondary" className="text-xs">
                                                                {point}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {expandedId === summary.id && (
                                                <div className="pt-4 border-t space-y-3">
                                                    <div>
                                                        <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Time Details</h4>
                                                        <div className="text-sm space-y-1">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Start:</span>
                                                                <span>{formatDateTime(summary.start_time)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">End:</span>
                                                                <span>{formatDateTime(summary.end_time)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Duration:</span>
                                                                <span>{formatDuration(summary.duration_ms)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {summary.participants && summary.participants.length > 0 && (
                                                        <div>
                                                            <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Participants</h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {summary.participants.map((participant, idx) => (
                                                                    <Badge key={idx} variant="outline">
                                                                        {participant}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}

