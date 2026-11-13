{{/* Name of a component, e.g. gradingpoker-backend */}}
{{- define "gradingpoker.name" -}}
{{- printf "%s-%s" .root.Release.Name .component | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Selector labels of a component, also used as pod labels.
Kept to the single "app" label of the former kubernetes.yaml, since selectors are immutable, and chart upgrades should not restart pods (Redis holds the rooms).
*/}}
{{- define "gradingpoker.selectorLabels" -}}
app: {{ include "gradingpoker.name" . }}
{{- end }}

{{- define "gradingpoker.labels" -}}
{{ include "gradingpoker.selectorLabels" . }}
app.kubernetes.io/name: {{ .root.Chart.Name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version }}
{{- end }}
