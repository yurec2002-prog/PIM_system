import { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, DollarSign, Image, Tag, FileText } from 'lucide-react';
import { NotReadyReason, REASON_LABELS, REASON_DESCRIPTIONS } from '../../utils/qualityCalculations';

interface QualityIndicatorProps {
  score: number;
  reasons: NotReadyReason[];
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

const REASON_ICONS: Record<NotReadyReason, typeof DollarSign> = {
  no_selling_price: DollarSign,
  no_images: Image,
  no_category_mapping: Tag,
  missing_required_attributes: FileText,
};

export function QualityIndicator({
  score,
  reasons,
  size = 'md',
  showDetails = true,
}: QualityIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getScoreColor = () => {
    if (score === 100) return 'bg-green-500';
    if (score >= 75) return 'bg-yellow-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTextColor = () => {
    if (score === 100) return 'text-green-700';
    if (score >= 75) return 'text-yellow-700';
    if (score >= 50) return 'text-orange-700';
    return 'text-red-700';
  };

  const getSizeClasses = () => {
    if (size === 'sm') return 'w-12 h-12 text-xs';
    if (size === 'lg') return 'w-20 h-20 text-lg';
    return 'w-16 h-16 text-sm';
  };

  return (
    <div className="relative">
      <div
        className="relative inline-block"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`${getSizeClasses()} relative`}>
          <svg className="transform -rotate-90 w-full h-full">
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - score / 100)}`}
              className={getScoreColor()}
              strokeLinecap="round"
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center font-bold ${getTextColor()}`}>
            {score}%
          </div>
        </div>

        {showTooltip && showDetails && (
          <div className="absolute z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-64 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3">
            <div className="font-semibold mb-2">Quality Score: {score}%</div>
            {reasons.length > 0 ? (
              <div className="space-y-2">
                <div className="text-gray-300 font-medium">Issues:</div>
                {reasons.map((reason, idx) => {
                  const Icon = REASON_ICONS[reason];
                  return (
                    <div key={idx} className="flex items-start gap-2">
                      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">{REASON_LABELS[reason]}</div>
                        <div className="text-gray-400 text-xs mt-0.5">
                          {REASON_DESCRIPTIONS[reason]}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>All quality checks passed</span>
              </div>
            )}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>

      {showDetails && reasons.length > 0 && (
        <div className="mt-2 space-y-1">
          {reasons.map((reason, idx) => {
            const Icon = REASON_ICONS[reason];
            return (
              <div
                key={idx}
                className="flex items-center gap-1 text-xs text-gray-600"
                title={REASON_DESCRIPTIONS[reason]}
              >
                <Icon className="w-3 h-3" />
                <span>{REASON_LABELS[reason]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function QualityBadge({ score }: { score: number }) {
  const getBadgeColor = () => {
    if (score === 100) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 75) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (score >= 50) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getBadgeColor()}`}>
      {score}%
    </span>
  );
}
