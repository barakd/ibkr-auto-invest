import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

interface AllocationInput {
  symbol: string
  targetPercent: string
  conid?: number
}

export function AllocationEditor(): React.JSX.Element {
  const { allocations, updateAllocations, bufferPercent, setBufferPercent } = useApp()

  const [inputs, setInputs] = useState<AllocationInput[]>([])
  const [newSymbol, setNewSymbol] = useState('')
  const [newPercent, setNewPercent] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Initialize inputs from allocations
  useEffect(() => {
    setInputs(
      allocations.map((a) => ({
        symbol: a.symbol,
        targetPercent: a.targetPercent.toString(),
        conid: a.conid
      }))
    )
  }, [allocations])

  const totalPercent = inputs.reduce((sum, input) => sum + (parseFloat(input.targetPercent) || 0), 0)

  const handleInputChange = (index: number, field: 'symbol' | 'targetPercent', value: string) => {
    const updated = [...inputs]
    updated[index] = { ...updated[index], [field]: value }
    setInputs(updated)
    setError('')
  }

  const handleAddAllocation = async () => {
    if (!newSymbol.trim()) {
      setError('Please enter a symbol')
      return
    }

    const percent = parseFloat(newPercent)
    if (isNaN(percent) || percent <= 0 || percent > 100) {
      setError('Please enter a valid percentage (1-100)')
      return
    }

    if (inputs.some((i) => i.symbol.toUpperCase() === newSymbol.toUpperCase())) {
      setError('Symbol already exists')
      return
    }

    // Look up conid
    try {
      const results = await window.ibkr.secdef.search(newSymbol)
      if (results.length === 0) {
        setError(`Could not find symbol: ${newSymbol}`)
        return
      }

      const firstResult = results[0] as { conid: number; symbol: string }
      setInputs([
        ...inputs,
        {
          symbol: firstResult.symbol,
          targetPercent: percent.toString(),
          conid: firstResult.conid
        }
      ])
      setNewSymbol('')
      setNewPercent('')
      setError('')
    } catch (err) {
      setError(`Error looking up symbol: ${err}`)
    }
  }

  const handleRemoveAllocation = (index: number) => {
    setInputs(inputs.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    // Validate
    const parsedAllocations = inputs.map((input) => ({
      symbol: input.symbol.toUpperCase(),
      targetPercent: parseFloat(input.targetPercent) || 0,
      conid: input.conid
    }))

    const total = parsedAllocations.reduce((sum, a) => sum + a.targetPercent, 0)
    if (total > 100) {
      setError(`Total allocation is ${total.toFixed(1)}%, which exceeds 100%`)
      return
    }

    if (parsedAllocations.some((a) => a.targetPercent <= 0)) {
      setError('All allocations must have a percentage greater than 0')
      return
    }

    setIsSaving(true)
    try {
      await updateAllocations(parsedAllocations)
      setError('')
    } catch (err) {
      setError(`Failed to save: ${err}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="allocation-editor">
      <h3>Target Allocation</h3>

      <div className="allocation-list">
        {inputs.map((input, index) => (
          <div key={index} className="allocation-row">
            <input
              type="text"
              value={input.symbol}
              onChange={(e) => handleInputChange(index, 'symbol', e.target.value.toUpperCase())}
              placeholder="Symbol"
              className="input symbol-input"
            />
            <div className="percent-input-wrapper">
              <input
                type="number"
                value={input.targetPercent}
                onChange={(e) => handleInputChange(index, 'targetPercent', e.target.value)}
                placeholder="%"
                min="0"
                max="100"
                step="0.1"
                className="input percent-input"
              />
              <span className="percent-suffix">%</span>
            </div>
            <button
              onClick={() => handleRemoveAllocation(index)}
              className="btn btn-danger btn-small"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="add-allocation">
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
          placeholder="New Symbol (e.g., SPY)"
          className="input symbol-input"
        />
        <div className="percent-input-wrapper">
          <input
            type="number"
            value={newPercent}
            onChange={(e) => setNewPercent(e.target.value)}
            placeholder="%"
            min="0"
            max="100"
            step="0.1"
            className="input percent-input"
          />
          <span className="percent-suffix">%</span>
        </div>
        <button onClick={handleAddAllocation} className="btn btn-secondary btn-small">
          Add
        </button>
      </div>

      <div className="allocation-summary">
        <span>Total: </span>
        <span className={totalPercent > 100 ? 'error' : totalPercent === 100 ? 'success' : ''}>
          {totalPercent.toFixed(1)}%
        </span>
        {totalPercent < 100 && (
          <span className="hint"> ({(100 - totalPercent).toFixed(1)}% cash)</span>
        )}
      </div>

      <div className="buffer-setting">
        <label>
          Safety Buffer:
          <div className="percent-input-wrapper">
            <input
              type="number"
              value={(bufferPercent * 100).toFixed(0)}
              onChange={(e) => setBufferPercent(parseFloat(e.target.value) / 100 || 0)}
              min="0"
              max="50"
              step="1"
              className="input percent-input"
            />
            <span className="percent-suffix">%</span>
          </div>
        </label>
        <span className="hint">Cash reserve to prevent negative balance</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
        {isSaving ? 'Saving...' : 'Save Allocations'}
      </button>
    </div>
  )
}
