@component('mail::message')
# Results Published

Dear {{ $parentName }},

The **{{ $assessmentType === 'mid_term' ? 'Mid‑Term' : 'End‑of‑Term' }}** results for **{{ $className }}** ({{ $termName }}) have been published.

You can now log into the parent portal to view your child’s report card and teacher comments.

@component('mail::button', ['url' => config('app.frontend_url') . '/dashboard/current-records'])
View Results
@endcomponent

If you have any questions, please contact the school administration.

Thanks,<br>
{{ config('app.name') }}
@endcomponent