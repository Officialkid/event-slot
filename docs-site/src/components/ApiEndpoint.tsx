type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'

const methodColors: Record<Method, string> = {
  GET:    'bg-green-900/40 text-green-400',
  POST:   'bg-blue-900/40 text-blue-400',
  PATCH:  'bg-yellow-900/40 text-yellow-400',
  DELETE: 'bg-red-900/40 text-red-400',
  PUT:    'bg-orange-900/40 text-orange-400',
}

interface Props {
  method: Method
  path: string
  auth?: string
  description: string
}

export function ApiEndpoint({ method, path, auth, description }: Props) {
  return (
    <div className="border border-[#2A2A2A] rounded-lg p-4 mb-4 bg-[#141414]">
      <div className="flex items-center gap-3 mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-[#C8F55A] text-sm font-mono">{path}</code>
        {auth && (
          <span className="ml-auto text-xs text-[#666] border border-[#2A2A2A] px-2 py-0.5 rounded">
            🔒 {auth}
          </span>
        )}
      </div>
      <p className="text-[#A3A3A3] text-sm">{description}</p>
    </div>
  )
}
