$ErrorActionPreference = 'Stop'

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

function ConvertFrom-Utf8Base64 {
  param([string]$Value)
  return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

$textQuestion = ConvertFrom-Utf8Base64 '5ZWP6aGMIA=='
$textCustom = ConvertFrom-Utf8Base64 '5YW25LuW77yP6KOc5YWF'
$textSubmit = ConvertFrom-Utf8Base64 '6YCB5Ye65Zue562U'
$textLater = ConvertFrom-Utf8Base64 '56iN5b6M6JmV55CG'
$textPleaseComplete = ConvertFrom-Utf8Base64 '6KuL5a6M5oiQ44CM'
$textClosingQuote = ConvertFrom-Utf8Base64 '44CN44CC'
$textSubmitted = ConvertFrom-Utf8Base64 '5bey6YCB5Ye677yM562J5b6F56K66KqN4oCm'
$textExclusive = ConvertFrom-Utf8Base64 '5Zau6YG46aGM6KuL6YG45pOH6YG46aCF5oiW5aGr5a+r5YW25LuW77yM5LiN6IO95ZCM5pmC5L2/55So44CC'
$textCustomTooLong = ConvertFrom-Utf8Base64 '6KOc5YWF5paH5a2X5LiN5Y+v6LaF6YGOIDE2MDAwIOWtl+WFg+OAgg=='
$textLastError = ConvertFrom-Utf8Base64 '5LiK5qyh6YCB5Ye65pyq6YCa6YGO77ya'
$textAllowOnce = ConvertFrom-Utf8Base64 '5YOF5YWB6Kix6YCZ5qyh'
$textReject = ConvertFrom-Utf8Base64 '5ouS57WV'
$textClose = ConvertFrom-Utf8Base64 '6Zec6ZaJ'
$textDefaultTitle = ConvertFrom-Utf8Base64 'RFNIIOmAmuefpQ=='
$textTool = ConvertFrom-Utf8Base64 '5bel5YW377ya'
$textReason = ConvertFrom-Utf8Base64 '5Y6f5Zug77ya'

$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Zeta &#x901A;&#x77E5;"
        Width="440"
        MinHeight="160"
        MaxHeight="650"
        SizeToContent="Height"
        ResizeMode="CanResizeWithGrip"
        WindowStartupLocation="Manual"
        Background="#0F172A"
        Foreground="#E5E7EB"
        ShowInTaskbar="True">
  <Border BorderBrush="#334155" BorderThickness="1" CornerRadius="14" Background="#0F172A">
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="52" />
        <RowDefinition Height="*" />
      </Grid.RowDefinitions>
      <Grid Grid.Row="0" Margin="18,0,18,0">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="*" />
          <ColumnDefinition Width="Auto" />
        </Grid.ColumnDefinitions>
        <TextBlock Text="Zeta &#x901A;&#x77E5;" FontSize="17" FontWeight="SemiBold" VerticalAlignment="Center" />
        <Border Grid.Column="1" CornerRadius="10" Background="#1E293B" Padding="9,4" VerticalAlignment="Center">
          <TextBlock Text="DSH" FontSize="11" Foreground="#94A3B8" />
        </Border>
      </Grid>
      <ScrollViewer x:Name="CardsScroll" Grid.Row="1" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled" Padding="10,0,10,10">
        <StackPanel x:Name="CardsPanel" />
      </ScrollViewer>
    </Grid>
  </Border>
</Window>
'@

$reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)
$cardsPanel = $window.FindName('CardsPanel')
$cards = @{}
$isShuttingDown = $false

function Write-Diagnostic {
  param([string]$Message)
  [Console]::Error.WriteLine($Message)
}

function Write-Protocol {
  param([object]$Message)
  $json = ConvertTo-Json -InputObject $Message -Compress -Depth 16
  [Console]::Out.WriteLine($json)
  [Console]::Out.Flush()
}

function Has-Property {
  param([object]$Object, [string]$Name)
  return $null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]
}

function Get-Property {
  param([object]$Object, [string]$Name, [object]$Default = $null)
  if (Has-Property $Object $Name) {
    return $Object.PSObject.Properties[$Name].Value
  }
  return $Default
}

function Get-Text {
  param([object]$Object, [string]$Name)
  $value = Get-Property $Object $Name ''
  if ($null -eq $value) { return '' }
  return [string]$value
}

function Get-Brush {
  param([string]$Color)
  return (New-Object System.Windows.Media.BrushConverter).ConvertFromString($Color)
}

function New-Text {
  param(
    [string]$Text,
    [double]$Size = 13,
    [string]$Color = '#CBD5E1',
    [string]$Weight = 'Normal',
    [double]$Bottom = 6
  )
  $control = New-Object System.Windows.Controls.TextBlock
  $control.Text = $Text
  $control.FontSize = $Size
  $control.Foreground = Get-Brush $Color
  $control.FontWeight = [System.Windows.FontWeights]::$Weight
  $control.TextWrapping = [System.Windows.TextWrapping]::Wrap
  $control.Margin = New-Object System.Windows.Thickness(0, 0, 0, $Bottom)
  return $control
}

function New-ActionButton {
  param(
    [string]$Label,
    [string]$Background = '#334155',
    [string]$Foreground = '#F8FAFC'
  )
  $button = New-Object System.Windows.Controls.Button
  $button.Background = Get-Brush $Background
  $button.Foreground = Get-Brush $Foreground
  $button.BorderThickness = New-Object System.Windows.Thickness(0)
  $button.Padding = New-Object System.Windows.Thickness(13, 7, 13, 7)
  $button.Margin = New-Object System.Windows.Thickness(0, 0, 8, 0)
  $button.Cursor = [System.Windows.Input.Cursors]::Hand
  $labelControl = New-Object System.Windows.Controls.TextBlock
  $labelControl.Text = $Label
  $labelControl.FontWeight = [System.Windows.FontWeights]::SemiBold
  $button.Content = $labelControl
  return $button
}

function New-MetadataMessage {
  param([string]$Type, [object]$Event)
  $message = [ordered]@{
    type = $Type
    id = Get-Text $Event 'id'
  }
  foreach ($name in @('requestId', 'sessionId', 'token')) {
    if (Has-Property $Event $name) {
      $message[$name] = Get-Property $Event $name
    }
  }
  return $message
}

function Update-WindowPosition {
  $workArea = [System.Windows.SystemParameters]::WorkArea
  $height = $window.ActualHeight
  if ($height -le 0) { $height = $window.DesiredSize.Height }
  if ($height -le 0) { $height = 220 }
  $window.Left = [Math]::Max($workArea.Left + 12, $workArea.Right - $window.Width - 16)
  $window.Top = [Math]::Max($workArea.Top + 12, $workArea.Bottom - $height - 16)
}

function Show-Window {
  param([bool]$Interactive)
  if (-not $window.IsVisible) {
    $window.Show()
  }
  $window.Dispatcher.BeginInvoke(
    [System.Windows.Threading.DispatcherPriority]::Loaded,
    [Action]{ Update-WindowPosition }
  ) | Out-Null
  if ($Interactive) {
    $window.Activate() | Out-Null
  }
}

function Remove-Card {
  param([string]$Id)
  if (-not $cards.ContainsKey($Id)) { return }
  $entry = $cards[$Id]
  $cardsPanel.Children.Remove($entry.Card) | Out-Null
  $cards.Remove($Id)
  if ($cards.Count -eq 0) {
    $window.Hide()
  } else {
    Update-WindowPosition
  }
}

function Add-Option {
  param(
    [System.Windows.Controls.StackPanel]$Panel,
    [object]$Option,
    [bool]$MultiSelect,
    [string]$GroupName,
    [System.Collections.ArrayList]$OptionStates
  )
  $row = New-Object System.Windows.Controls.StackPanel
  $row.Margin = New-Object System.Windows.Thickness(0, 1, 0, 5)

  if ($MultiSelect) {
    $selector = New-Object System.Windows.Controls.CheckBox
  } else {
    $selector = New-Object System.Windows.Controls.RadioButton
    $selector.GroupName = $GroupName
  }
  $selector.Foreground = Get-Brush '#E2E8F0'
  $selector.VerticalContentAlignment = [System.Windows.VerticalAlignment]::Top
  $selector.Margin = New-Object System.Windows.Thickness(0, 1, 0, 0)

  $label = Get-Text $Option 'label'
  $labelControl = New-Text $label 13 '#E2E8F0' 'Normal' 0
  $selector.Content = $labelControl
  $row.Children.Add($selector) | Out-Null

  $description = Get-Text $Option 'description'
  if ($description) {
    $descriptionControl = New-Text $description 11 '#94A3B8' 'Normal' 0
    $descriptionControl.Margin = New-Object System.Windows.Thickness(24, 2, 0, 0)
    $row.Children.Add($descriptionControl) | Out-Null
  }
  $Panel.Children.Add($row) | Out-Null
  $OptionStates.Add([pscustomobject]@{ Label = $label; Control = $selector }) | Out-Null
}

function Add-Question {
  param(
    [System.Windows.Controls.StackPanel]$Panel,
    [object]$Question,
    [int]$Index,
    [System.Collections.ArrayList]$AnswerStates
  )
  $questionPanel = New-Object System.Windows.Controls.StackPanel
  $questionPanel.Margin = New-Object System.Windows.Thickness(0, 8, 0, 7)

  $header = Get-Text $Question 'header'
  if (-not $header) { $header = $script:textQuestion + ($Index + 1) }
  $questionPanel.Children.Add((New-Text $header 11 '#38BDF8' 'SemiBold' 3)) | Out-Null
  $questionPanel.Children.Add((New-Text (Get-Text $Question 'question') 13 '#F8FAFC' 'SemiBold' 4)) | Out-Null

  $detail = Get-Text $Question 'detail'
  if ($detail) {
    $questionPanel.Children.Add((New-Text $detail 11 '#94A3B8' 'Normal' 7)) | Out-Null
  }

  $multiSelect = [bool](Get-Property $Question 'multiSelect' $false)
  $optionStates = New-Object System.Collections.ArrayList
  $groupName = 'q_' + [Guid]::NewGuid().ToString('N')
  $options = @(Get-Property $Question 'options' @())
  foreach ($option in $options) {
    Add-Option $questionPanel $option $multiSelect $groupName $optionStates
  }

  $customLabel = New-Text $script:textCustom 11 '#94A3B8' 'Normal' 3
  $custom = New-Object System.Windows.Controls.TextBox
  $custom.AcceptsReturn = $true
  $custom.MaxLength = 16000
  $custom.MinHeight = 34
  $custom.MaxHeight = 90
  $custom.TextWrapping = [System.Windows.TextWrapping]::Wrap
  $custom.VerticalScrollBarVisibility = [System.Windows.Controls.ScrollBarVisibility]::Auto
  $custom.Background = Get-Brush '#0B1220'
  $custom.Foreground = Get-Brush '#F8FAFC'
  $custom.BorderBrush = Get-Brush '#475569'
  $custom.Padding = New-Object System.Windows.Thickness(7, 5, 7, 5)
  $questionPanel.Children.Add($customLabel) | Out-Null
  $questionPanel.Children.Add($custom) | Out-Null

  if (-not $multiSelect) {
    $statesForCustom = $optionStates
    $custom.Add_TextChanged({
      if ($custom.Text.Length -gt 0) {
        foreach ($optionState in $statesForCustom) {
          $optionState.Control.IsChecked = $false
        }
      }
    }.GetNewClosure())
    foreach ($optionState in $optionStates) {
      $selectorForCustom = $optionState.Control
      $selectorForCustom.Add_Checked({
        if ($selectorForCustom.IsChecked -eq $true -and $custom.Text.Length -gt 0) {
          $custom.Clear()
        }
      }.GetNewClosure())
    }
  }

  $Panel.Children.Add($questionPanel) | Out-Null
  $AnswerStates.Add([pscustomobject]@{
    Id = Get-Text $Question 'id'
    Header = $header
    MultiSelect = $multiSelect
    Options = $optionStates
    Custom = $custom
  }) | Out-Null
}

function Add-QuestionActions {
  param(
    [System.Windows.Controls.StackPanel]$Panel,
    [object]$Event,
    [System.Collections.ArrayList]$AnswerStates,
    [string]$Id
  )
  $validation = New-Text '' 11 '#FCA5A5' 'Normal' 4
  $validation.Visibility = [System.Windows.Visibility]::Collapsed
  $Panel.Children.Add($validation) | Out-Null

  $buttons = New-Object System.Windows.Controls.StackPanel
  $buttons.Orientation = [System.Windows.Controls.Orientation]::Horizontal
  $buttons.Margin = New-Object System.Windows.Thickness(0, 6, 0, 0)
  $submit = New-ActionButton $script:textSubmit '#0284C7'
  $dismiss = New-ActionButton $script:textLater '#334155'
  $buttons.Children.Add($submit) | Out-Null
  $buttons.Children.Add($dismiss) | Out-Null
  $Panel.Children.Add($buttons) | Out-Null

  $submit.Add_Click({
    $answers = New-Object System.Collections.ArrayList
    foreach ($state in $AnswerStates) {
      $selected = New-Object System.Collections.ArrayList
      foreach ($optionState in $state.Options) {
        if ($optionState.Control.IsChecked -eq $true) {
          $selected.Add($optionState.Label) | Out-Null
        }
      }
      $custom = $state.Custom.Text.Trim()
      if ($custom.Length -gt 16000) {
        $validation.Text = $script:textCustomTooLong
        $validation.Visibility = [System.Windows.Visibility]::Visible
        return
      }
      if (-not $state.MultiSelect -and $selected.Count -gt 0 -and $custom) {
        $validation.Text = $script:textExclusive
        $validation.Visibility = [System.Windows.Visibility]::Visible
        return
      }
      if ($selected.Count -eq 0 -and -not $custom) {
        $validation.Text = $script:textPleaseComplete + $state.Header + $script:textClosingQuote
        $validation.Visibility = [System.Windows.Visibility]::Visible
        return
      }
      $answer = [ordered]@{
        id = $state.Id
        selected = @($selected.ToArray())
      }
      if ($custom) { $answer['custom'] = $custom }
      $answers.Add($answer) | Out-Null
    }
    $message = New-MetadataMessage 'respond' $Event
    $message['answers'] = @($answers.ToArray())
    Write-Protocol $message
    $submit.IsEnabled = $false
    $dismiss.IsEnabled = $false
    $validation.Text = $script:textSubmitted
    $validation.Foreground = Get-Brush '#7DD3FC'
    $validation.Visibility = [System.Windows.Visibility]::Visible
  }.GetNewClosure())

  $dismiss.Add_Click({
    Write-Protocol (New-MetadataMessage 'dismiss' $Event)
    Remove-Card $Id
  }.GetNewClosure())
}

function Add-ApprovalActions {
  param(
    [System.Windows.Controls.StackPanel]$Panel,
    [object]$Event,
    [string]$Id
  )
  $status = New-Text $script:textSubmitted 11 '#7DD3FC' 'Normal' 4
  $status.Visibility = [System.Windows.Visibility]::Collapsed
  $Panel.Children.Add($status) | Out-Null
  $buttons = New-Object System.Windows.Controls.StackPanel
  $buttons.Orientation = [System.Windows.Controls.Orientation]::Horizontal
  $buttons.Margin = New-Object System.Windows.Thickness(0, 9, 0, 0)
  $allow = New-ActionButton $script:textAllowOnce '#059669'
  $reject = New-ActionButton $script:textReject '#B91C1C'
  $dismiss = New-ActionButton $script:textLater '#334155'
  $buttons.Children.Add($allow) | Out-Null
  $buttons.Children.Add($reject) | Out-Null
  $buttons.Children.Add($dismiss) | Out-Null
  $Panel.Children.Add($buttons) | Out-Null

  $allow.Add_Click({
    $message = New-MetadataMessage 'respond' $Event
    $message['decision'] = 'allowed-once'
    Write-Protocol $message
    $allow.IsEnabled = $false
    $reject.IsEnabled = $false
    $dismiss.IsEnabled = $false
    $status.Visibility = [System.Windows.Visibility]::Visible
  }.GetNewClosure())
  $reject.Add_Click({
    $message = New-MetadataMessage 'respond' $Event
    $message['decision'] = 'rejected'
    Write-Protocol $message
    $allow.IsEnabled = $false
    $reject.IsEnabled = $false
    $dismiss.IsEnabled = $false
    $status.Visibility = [System.Windows.Visibility]::Visible
  }.GetNewClosure())
  $dismiss.Add_Click({
    Write-Protocol (New-MetadataMessage 'dismiss' $Event)
    Remove-Card $Id
  }.GetNewClosure())
}

function Add-DismissAction {
  param(
    [System.Windows.Controls.StackPanel]$Panel,
    [object]$Event,
    [string]$Id
  )
  $dismiss = New-ActionButton $script:textClose '#334155'
  $dismiss.Margin = New-Object System.Windows.Thickness(0, 7, 0, 0)
  $Panel.Children.Add($dismiss) | Out-Null
  $dismiss.Add_Click({
    Write-Protocol (New-MetadataMessage 'dismiss' $Event)
    Remove-Card $Id
  }.GetNewClosure())
}

function Show-Notification {
  param([object]$Event, [object]$Settings)
  $id = Get-Text $Event 'id'
  if (-not $id) { throw 'show event requires a non-empty id' }
  Remove-Card $id

  $card = New-Object System.Windows.Controls.Border
  $card.Background = Get-Brush '#1E293B'
  $card.BorderBrush = Get-Brush '#334155'
  $card.BorderThickness = New-Object System.Windows.Thickness(1)
  $card.CornerRadius = New-Object System.Windows.CornerRadius(11)
  $card.Padding = New-Object System.Windows.Thickness(14)
  $card.Margin = New-Object System.Windows.Thickness(0, 0, 0, 9)

  $content = New-Object System.Windows.Controls.StackPanel
  $card.Child = $content

  $kind = Get-Text $Event 'kind'
  $questions = @(Get-Property $Event 'questions' @())
  $interactive =
    [bool](Get-Text $Event 'requestId') -or
    [bool](Get-Text $Event 'token') -or
    $questions.Count -gt 0 -or
    $kind -in @('question', 'approval', 'plan')
  $previewEnabled = -not (Has-Property $Settings 'preview') -or [bool](Get-Property $Settings 'preview' $true)
  $showDetails = $interactive -or $previewEnabled
  $kindLabel = if ($kind) { $kind.ToUpperInvariant() } else { 'NOTICE' }
  $content.Children.Add((New-Text $kindLabel 10 '#38BDF8' 'SemiBold' 4)) | Out-Null

  $title = Get-Text $Event 'title'
  if (-not $showDetails -or -not $title) { $title = $script:textDefaultTitle }
  $content.Children.Add((New-Text $title 15 '#F8FAFC' 'SemiBold' 5)) | Out-Null

  $body = Get-Text $Event 'body'
  if ($showDetails -and $body) { $content.Children.Add((New-Text $body 13 '#CBD5E1' 'Normal' 6)) | Out-Null }

  $detail = Get-Text $Event 'detail'
  if ($showDetails -and $detail) { $content.Children.Add((New-Text $detail 11 '#94A3B8' 'Normal' 6)) | Out-Null }

  $toolName = Get-Text $Event 'toolName'
  if ($showDetails -and $toolName) { $content.Children.Add((New-Text ($script:textTool + $toolName) 11 '#A5B4FC' 'SemiBold' 3)) | Out-Null }
  $reason = Get-Text $Event 'reason'
  if ($showDetails -and $reason) { $content.Children.Add((New-Text ($script:textReason + $reason) 11 '#CBD5E1' 'Normal' 6)) | Out-Null }

  $submissionError = Get-Text $Event 'error'
  if ($submissionError) {
    $content.Children.Add((New-Text ($script:textLastError + $submissionError) 11 '#FCA5A5' 'SemiBold' 7)) | Out-Null
  }

  $answerStates = New-Object System.Collections.ArrayList
  for ($index = 0; $index -lt $questions.Count; $index++) {
    Add-Question $content $questions[$index] $index $answerStates
  }

  if ($kind -eq 'approval') {
    Add-ApprovalActions $content $Event $id
  } elseif ($questions.Count -gt 0) {
    Add-QuestionActions $content $Event $answerStates $id
  } else {
    Add-DismissAction $content $Event $id
  }

  $persistent = $interactive
  $expiresAt = if ($persistent) { $null } else { [DateTime]::UtcNow.AddSeconds(8) }
  $cards[$id] = [pscustomobject]@{ Card = $card; ExpiresAt = $expiresAt }
  $cardsPanel.Children.Add($card) | Out-Null

  $sound = [bool](Get-Property $Settings 'sound' $false)
  $volume = [double](Get-Property $Settings 'volume' 1.0)
  if ($sound -and $volume -gt 0) {
    [System.Media.SystemSounds]::Asterisk.Play()
  }
  Show-Window $persistent
  Write-Protocol ([ordered]@{ type = 'shown'; id = $id })
}

function Shutdown-Helper {
  $script:isShuttingDown = $true
  $script:timer.Stop()
  $window.Close()
  $script:application.Shutdown()
}

function Handle-InputLine {
  param([string]$Line)
  if (-not $Line) { return }
  $message = ConvertFrom-Json -InputObject $Line -ErrorAction Stop
  $type = Get-Text $message 'type'
  switch ($type) {
    'show' {
      Show-Notification (Get-Property $message 'event') (Get-Property $message 'settings' ([pscustomobject]@{}))
    }
    'close' {
      Remove-Card (Get-Text $message 'id')
    }
    'shutdown' {
      Shutdown-Helper
    }
    default {
      throw ('Unknown message type: ' + $type)
    }
  }
}

$window.Add_Closing({
  param($sender, $eventArgs)
  if (-not $script:isShuttingDown) {
    $eventArgs.Cancel = $true
    $sender.Hide()
  }
})

$application = New-Object System.Windows.Application
$application.ShutdownMode = [System.Windows.ShutdownMode]::OnExplicitShutdown
$application.Add_DispatcherUnhandledException({
  param($sender, $eventArgs)
  Write-Diagnostic ('Fatal native UI error: ' + $eventArgs.Exception.Message)
  $eventArgs.Handled = $true
  Shutdown-Helper
})

$stdinStream = [Console]::OpenStandardInput()
$stdinReader = New-Object System.IO.StreamReader(
  $stdinStream,
  (New-Object System.Text.UTF8Encoding($false)),
  $true,
  4096,
  $true
)
$pendingRead = $stdinReader.ReadLineAsync()
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(50)
$timer.Add_Tick({
  try {
    if ($script:pendingRead.IsCompleted) {
      $line = $script:pendingRead.GetAwaiter().GetResult()
      if ($null -eq $line) {
        Shutdown-Helper
        return
      }
      try {
        Handle-InputLine $line
      } catch {
        Write-Diagnostic ('Invalid native helper input: ' + $_.Exception.Message)
      }
      if (-not $script:isShuttingDown) {
        $script:pendingRead = $script:stdinReader.ReadLineAsync()
      }
    }

    $expired = New-Object System.Collections.ArrayList
    foreach ($id in @($script:cards.Keys)) {
      $expiresAt = $script:cards[$id].ExpiresAt
      if ($null -ne $expiresAt -and [DateTime]::UtcNow -ge $expiresAt) {
        $expired.Add($id) | Out-Null
      }
    }
    foreach ($id in $expired) { Remove-Card $id }
  } catch {
    Write-Diagnostic ('Fatal native helper error: ' + $_.Exception.Message)
    Shutdown-Helper
  }
})

$workArea = [System.Windows.SystemParameters]::WorkArea
$window.MaxHeight = [Math]::Min(650, [Math]::Max(220, $workArea.Height - 24))
Write-Protocol ([ordered]@{ type = 'ready' })
$timer.Start()
[void]$application.Run()
