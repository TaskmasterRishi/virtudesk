'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAllPlayers, getSelfId } from '@/game/realtime/PlayerRealtime'
import { ChevronRight } from "lucide-react"

type PlayerInfo = { id: string; name?: string; character?: string; avatar?: string }

export default function PlayersPanel() {
	const [players, setPlayers] = useState<PlayerInfo[]>([])
	const [isCollapsed, setIsCollapsed] = useState(false)
	const selfId = getSelfId()
	const { user } = useUser()

	const refresh = useCallback(() => {
		const all = getAllPlayers()
		const filtered = all.filter((p) => p.id)
		setPlayers(filtered)
	}, [])

	useEffect(() => {
		refresh()
		const t = setInterval(refresh, 1000)
		return () => clearInterval(t)
	}, [refresh])

	// Show max 5 avatars, collapse extras into "+N" avatar
	const maxVisible = 5
	const visiblePlayers = players.slice(0, maxVisible)
	const extraCount = Math.max(0, players.length - maxVisible)

	return (
		<div className="absolute top-4 right-4 z-50 pointer-events-auto">
			<div className="relative">
				{/* Frosted glass background */}
				<div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20" />
				
				{/* Toggle button */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={() => setIsCollapsed(!isCollapsed)}
								className="absolute -left-8 top-1/2 -translate-y-1/2 z-20 bg-white border border-white/30 rounded-full p-1.5 hover:bg-slate-100 transition-all duration-200 hover:scale-110"
							>
								<ChevronRight
									className={`w-4 h-4 text-slate-700 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
								/>
							</button>
						</TooltipTrigger>
						<TooltipContent side="left" className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 text-white px-2 py-1 rounded-md shadow-xl">
							<p className="text-xs font-medium">{isCollapsed ? 'Show players' : 'Hide players'}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				
				{/* Players container with collapse animation */}
				<div className={`relative overflow-hidden transition-all duration-300 ease-in-out ${
					isCollapsed ? 'max-w-0 opacity-0' : 'max-w-96 opacity-100'
				}`}>
					<div className="flex items-center gap-2 p-3 overflow-x-auto scrollbar-hide">
						{visiblePlayers.map((p) => {
							const isCurrentUser = p.id === selfId
							const displayName = p.name || p.id
							
							return (
								<TooltipProvider key={p.id}>
									<Tooltip>
										<TooltipTrigger asChild>
											<div className="relative flex-shrink-0">
												{/* Gradient ring for current user */}
												{isCurrentUser && (
													<div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-full opacity-60 blur-sm" />
												)}
												
												<Avatar className="h-10 w-10 cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/25 relative z-10">
													<AvatarImage 
														src={p.avatar || (isCurrentUser ? user?.imageUrl : undefined)} 
														alt={displayName} 
														className="object-cover"
													/>
													<AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 border border-slate-300/50">
														{isCurrentUser 
															? (user?.fullName?.split(' ').map(word => word[0]).join('') || 'U')
															: displayName.charAt(0).toUpperCase()
														}
													</AvatarFallback>
												</Avatar>
											</div>
										</TooltipTrigger>
										<TooltipContent 
											side="bottom" 
											className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 text-white px-3 py-2 rounded-lg shadow-xl"
										>
											<div className="text-center">
												<p className="font-medium text-sm">{displayName}</p>
												{isCurrentUser && (
													<p className="text-xs text-slate-400 mt-1">You</p>
												)}
											</div>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)
						})}
						
						{/* "+N" avatar for extra players */}
						{extraCount > 0 && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Avatar className="h-10 w-10 cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-purple-500/25 flex-shrink-0">
											<AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 border border-purple-300/50">
												+{extraCount}
											</AvatarFallback>
										</Avatar>
									</TooltipTrigger>
									<TooltipContent 
										side="bottom" 
										className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 text-white px-3 py-2 rounded-lg shadow-xl"
									>
										<p className="font-medium text-sm">{extraCount} more player{extraCount > 1 ? 's' : ''}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>
				</div>
			</div>
			
			{/* Custom scrollbar styles */}
			<style jsx>{`
				.scrollbar-hide {
					-ms-overflow-style: none;
					scrollbar-width: none;
				}
				.scrollbar-hide::-webkit-scrollbar {
					display: none;
				}
			`}</style>
		</div>
	)
}