import { QueryClient } from '@tanstack/react-query'

// Exporté pour les modules hors React (gestionnaire d'upload, actions globales)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
})

export const invalidateFiles = () => {
  queryClient.invalidateQueries({ queryKey: ['files'] })
  queryClient.invalidateQueries({ queryKey: ['folders'] })
  queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
  queryClient.invalidateQueries({ queryKey: ['my-stats'] })
}
